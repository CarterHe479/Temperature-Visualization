// Global variables
let weatherData = [];
let waterQualityData = [];
let monthlyData = [];
let yearlyAvgTemp = [];
let firstWarmYear = null;
let yearRange = { min: 1950, max: 2024 };
let selectedYearA = 2020;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tabs
    initTabs();

    // Load data
    loadData();

    // Set up event listeners
    document.getElementById('yearSliderA').addEventListener('input', (e) => {
        selectedYearA = parseInt(e.target.value);
        document.getElementById('yearDisplayA').textContent = selectedYearA;
        document.getElementById('selectedYearA').textContent = selectedYearA;
        updateMonthlyTemperatureChart();
    });
});

// Initialize tabs
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Load CSV data
async function loadData() {
    try {
        // Show loading indicator
        document.getElementById('loading').style.display = 'flex';

        // Load weather data
        const weatherResponse = await fetch('weather.csv');
        const weatherText = await weatherResponse.text();
        const weatherData = parseWeatherCSV(weatherText);
        processWeatherData(weatherData);

        // Load water quality data
        const waterQualityResponse = await fetch('Drinking_Water_Quality_Distribution_Monitoring_Data_20250313.csv');
        const waterQualityText = await waterQualityResponse.text();
        const waterQualityData = parseWaterQualityCSV(waterQualityText);
        processWaterQualityData(waterQualityData);

        // Initialize charts
        initCharts();

        // Hide loading indicator
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

// Parse weather CSV
function parseWeatherCSV(csvText) {
    const results = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    });

    return results.data;
}

// Parse water quality CSV
function parseWaterQualityCSV(csvText) {
    const results = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    });

    return results.data;
}

// Process weather data
function processWeatherData(data) {
    // Convert raw data to structured format
    weatherData = data.filter(row => row.Ktemp).map(row => {
        const date = new Date(row.time);
        return {
            ...row,
            date: date,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            Ftemp: ((row.Ktemp - 273.15) * (9/5) + 32).toFixed(2) * 1, // Convert to Fahrenheit
        };
    });

    // Update year range based on actual data
    const years = weatherData.map(row => row.year);
    if (years.length > 0) {
        yearRange.min = Math.min(...years);
        yearRange.max = Math.max(...years);
    }

    // Update UI sliders
    document.getElementById('yearSliderA').min = yearRange.min;
    document.getElementById('yearSliderA').max = yearRange.max;

    // Default to most recent year
    selectedYearA = yearRange.max;
    document.getElementById('yearSliderA').value = selectedYearA;
    document.getElementById('yearDisplayA').textContent = selectedYearA;
    document.getElementById('selectedYearA').textContent = selectedYearA;

    // Process monthly averages
    processMonthlyAverages();

    // Find first warm year
    findFirstWarmYear();
}

// Process water quality data
function processWaterQualityData(data) {
    // Parse and clean water quality data
    waterQualityData = data
      .filter(row => row["Sample Date"] && row["Turbidity (NTU)"])
      .map(row => {
            // Parse date from Sample Date field (assuming format MM/DD/YYYY)
            const dateParts = row["Sample Date"].split("/");
            let date;

            if (dateParts.length === 3) {
                const month = parseInt(dateParts[0]);
                const day = parseInt(dateParts[1]);
                const year = parseInt(dateParts[2]);
                date = new Date(year, month - 1, day);
            } else {
                // Try ISO format or other formats
                date = new Date(row["Sample Date"]);
            }

            // Parse turbidity
            const turbidity = parseTurbidity(row["Turbidity (NTU)"]);

            return {
                date: date,
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                turbidity: turbidity
            };
        })
      .filter(item => !isNaN(item.date.getTime()) && item.turbidity !== null);
}

// Helper function to parse turbidity values
function parseTurbidity(value) {
    if (!value || value === "") return null;
    // Remove any non-numeric characters except decimal point
    const cleaned = value.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

// Process monthly average temperatures
function processMonthlyAverages() {
    // Group by year and month
    const groupedByYearAndMonth = _.groupBy(weatherData, row => `${row.year}-${row.month}`);

    // Calculate averages for each year-month combination
    const monthlyAverages = Object.keys(groupedByYearAndMonth).map(key => {
        const [year, month] = key.split('-').map(Number);
        const monthData = groupedByYearAndMonth[key];
        const avgTemp = _.meanBy(monthData, 'Ftemp');

        return {
            year,
            month,
            avgTemp: parseFloat(avgTemp.toFixed(2)),
            monthName: new Date(2000, month - 1, 1).toLocaleString('default', { month: 'short' })
        };
    });

    // Group by year for yearly averages
    const groupedByYear = _.groupBy(monthlyAverages, 'year');

    // Convert to array of yearly data with monthly temperatures
    monthlyData = Object.keys(groupedByYear).map(year => {
        const yearData = groupedByYear[year];
        // Sort by month
        yearData.sort((a, b) => a.month - b.month);

        // Create an object with both month names and month numbers as keys
        const monthlyTemps = {};
        yearData.forEach(month => {
            monthlyTemps[month.monthName] = month.avgTemp;
            monthlyTemps[month.month] = month.avgTemp;
        });

        return {
            year: parseInt(year),
            ...monthlyTemps,
            avgTemp: parseFloat(_.meanBy(yearData, 'avgTemp').toFixed(2))
        };
    });

    // Calculate yearly average temperatures
    yearlyAvgTemp = Object.keys(groupedByYear).map(year => ({
        year: parseInt(year),
        avgTemp: parseFloat(_.meanBy(groupedByYear[year], 'avgTemp').toFixed(2))
    }));

    // Sort by year
    yearlyAvgTemp.sort((a, b) => a.year - b.year);
}

// Find first year with average temperature above 55°F
function findFirstWarmYear() {
    const warmYear = yearlyAvgTemp.find(year => year.avgTemp > 55);

    if (warmYear) {
        firstWarmYear = warmYear;
        document.getElementById('warmYearInfo').innerHTML = `
            <p>The first year where the average temperature exceeded 55°F was ${warmYear.year} (${warmYear.avgTemp.toFixed(2)}°F).</p>
        `;
    }
}

// Get data for selected year
function getMonthlyChartData(selectedYear) {
    const yearData = monthlyData.find(year => year.year === selectedYear) || {};
    if (!yearData || Object.keys(yearData).length === 0) return [];

    // Create data points for each month
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames.map((month, index) => {
        const monthNum = index + 1;

        // Look for temperature data in various formats
        let temperature = null;
        if (yearData[month]) {
            temperature = yearData[month];
        } else if (yearData[monthNum]) {
            temperature = yearData[monthNum];
        }

        return {
            month: month,
            temperature: temperature
        };
    });
}

// Initialize charts
function initCharts() {
    // Monthly Temperature Chart
    const monthlyTempCtx = document.getElementById('monthlyTempChart').getContext('2d');
    charts.monthlyTempChart = new Chart(monthlyTempCtx, {
        type: 'bar',
        data: {
            labels: getMonthlyChartData(selectedYearA).map(item => item.month),
            datasets: [{
                label: 'Average Temperature (°F)',
                data: getMonthlyChartData(selectedYearA).map(item => item.temperature),
                backgroundColor: 'rgba(255, 99, 71, 0.6)',
                borderColor: 'rgba(255, 99, 71, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Yearly Temperature Chart
    const yearlyTempCtx = document.getElementById('yearlyTempChart').getContext('2d');
    charts.yearlyTempChart = new Chart(yearlyTempCtx, {
        type: 'line',
        data: {
            labels: yearlyAvgTemp.map(item => item.year),
            datasets: [{
                label: 'Yearly Average Temperature (°F)',
                data: yearlyAvgTemp.map(item => item.avgTemp),
                backgroundColor: 'rgba(255, 165, 0, 0.6)',
                borderColor: 'rgba(255, 165, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Initial update
    updateMonthlyTemperatureChart();
}

// Update Monthly Temperature Chart
function updateMonthlyTemperatureChart() {
    if (charts.monthlyTempChart) {
        charts.monthlyTempChart.data.labels = getMonthlyChartData(selectedYearA).map(item => item.month);
        charts.monthlyTempChart.data.datasets[0].data = getMonthlyChartData(selectedYearA).map(item => item.temperature);
        charts.monthlyTempChart.update();
    }
}    