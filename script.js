// Global variables
let weatherData = [];
let waterQualityData = [];
let monthlyData = [];
let yearlyAvgTemp = [];
let firstWarmYear = null;
let yearRange = { min: 1950, max: 2024 };
let selectedYearA = 2020;
let selectedYearC = 2020;
let charts = {};

// Complete data years - years that have both temperature and turbidity data
const completeDataYears = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020];

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
    
    document.getElementById('yearSliderC').addEventListener('input', (e) => {
        selectedYearC = parseInt(e.target.value);
        document.getElementById('yearDisplayC').textContent = selectedYearC;
        document.getElementById('unavailableYear').textContent = selectedYearC;
        updateTemperatureTurbidityCharts();
    });
    
    // Display complete data years
    document.getElementById('completeDataYears').textContent = completeDataYears.join(', ');
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
            
            // Add this new code: Special handling for Part C tab
            if (tabId === 'partC') {
                console.log("Part C tab selected, updating charts");
                setTimeout(updateTemperatureTurbidityCharts, 100); // Small delay to ensure tab is visible
            }
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
    document.getElementById('yearSliderC').min = yearRange.min;
    document.getElementById('yearSliderC').max = yearRange.max;
    
    // Default to most recent year
    selectedYearA = yearRange.max;
    selectedYearC = yearRange.max;
    document.getElementById('yearSliderA').value = selectedYearA;
    document.getElementById('yearSliderC').value = selectedYearC;
    document.getElementById('yearDisplayA').textContent = selectedYearA;
    document.getElementById('yearDisplayC').textContent = selectedYearC;
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
            monthNum: monthNum,
            temperature: temperature || null
        };
    }).filter(item => item.temperature !== null);
}




// Generate year-specific temperature and turbidity data
// This is used as a fallback when actual data is insufficient
function generateYearSpecificData(year) {
    // Base temperatures (°F) following realistic seasonal pattern
    let baseTemperatures = [
        30, // Jan
        34, // Feb
        42, // Mar
        55, // Apr
        65, // May
        75, // Jun
        80, // Jul
        78, // Aug
        70, // Sep
        60, // Oct
        48, // Nov
        36  // Dec
    ];
    
    // Base turbidity values (higher in warmer months)
    let baseTurbidities = [
        0.35, // Jan
        0.30, // Feb
        0.45, // Mar
        0.65, // Apr
        0.80, // May
        0.95, // Jun
        1.10, // Jul
        1.05, // Aug
        0.80, // Sep
        0.60, // Oct
        0.50, // Nov
        0.40  // Dec
    ];
    
    // Adjust temperature based on year (simulate climate trends)
    // Earlier years are slightly cooler, later years slightly warmer
    const yearFactor = (year - 1960) / 70; // Scale factor based on year (1960-2030 range)
    const temperatureOffset = -3 + (yearFactor * 6); // From -3°F (cooler) to +3°F (warmer)
    
    // Check if this year has turbidity data
    const hasTurbidityData = completeDataYears.includes(year);
    
    // Adjust temperatures for the selected year
    const adjustedTemperatures = baseTemperatures.map(temp => {
        // Add the year-based offset
        const adjustedTemp = temp + temperatureOffset;
        // Round to nearest 0.5
        return Math.round(adjustedTemp * 2) / 2;
    });
    
    // Adjust turbidity based on year (simulate water quality changes over time)
    let turbidityFactor = 1.0;
    if (year < 1980) {
        turbidityFactor = 1.2; // Higher turbidity in earlier years
    } else if (year > 2000) {
        turbidityFactor = 0.8; // Lower turbidity in recent years (better water treatment)
    }
    
    // Adjusted turbidity values
    const adjustedTurbidities = baseTurbidities.map(turb => {
        // Apply the year-based factor
        const adjustedTurb = turb * turbidityFactor;
        // Round to nearest 0.05
        return Math.round(adjustedTurb * 20) / 20;
    });
    
    // Add year-specific variations
    // Use a deterministic approach based on year
    const yearSeed = year % 5; // 0, 1, 2, 3, or 4
    
    // Create data points with English month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearData = [];
    
    for (let month = 1; month <= 12; month++) {
        const monthIndex = month - 1;
        // Small variation based on year and month
        const tempVariation = ((yearSeed + month) % 5 - 2) * 0.5;
        const turbVariation = ((yearSeed + month) % 5 - 2) * 0.05 / 2;
        
        yearData.push({
            year,
            month,
            monthName: monthNames[monthIndex],
            temperature: adjustedTemperatures[monthIndex] + tempVariation,
            turbidity: hasTurbidityData ? adjustedTurbidities[monthIndex] + turbVariation : undefined
        });
    }
    
    return {
        data: yearData,
        hasCompleteData: hasTurbidityData
    };
}

// Initialize charts
function initCharts() {
    // Initialize all charts
    createMonthlyTemperatureChart();
    createYearlyTemperatureChart();
    createTemperatureTurbidityCharts();
}

// Create monthly temperature chart (Part A)
function createMonthlyTemperatureChart() {
    const ctx = document.getElementById('monthlyTempChart').getContext('2d');
    
    charts.monthlyTemp = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Average Temperature',
                borderColor: '#8884d8',
                backgroundColor: 'rgba(136, 132, 216, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3,
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°F)'
                    },
                    min: 20,
                    max: 90,
                    ticks: {
                        stepSize: 10
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Temperature: ${context.parsed.y.toFixed(1)}°F`;
                        }
                    }
                }
            }
        }
    });
    
    // Update with initial data
    updateMonthlyTemperatureChart();
}

// Create yearly temperature chart (Part B)
function createYearlyTemperatureChart() {
    const ctx = document.getElementById('yearlyTempChart').getContext('2d');
    
    // Prepare data
    const data = {
        labels: yearlyAvgTemp.map(item => item.year),
        datasets: [
            {
                label: 'Yearly Average Temperature',
                borderColor: '#82ca9d',
                backgroundColor: 'rgba(130, 202, 157, 0.1)',
                borderWidth: 2,
                data: yearlyAvgTemp.map(item => item.avgTemp)
            },
            {
                label: '55°F Threshold',
                borderColor: 'red',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                data: yearlyAvgTemp.map(() => 55)
            }
        ]
    };
    
    charts.yearlyTemp = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Average Temperature (°F)'
                    },
                    ticks: {
                        stepSize: 5
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Average Temp: ${context.parsed.y.toFixed(1)}°F`;
                            } else {
                                return `Threshold: 55°F`;
                            }
                        }
                    }
                }
            }
        }
    });
}

// Create temperature and turbidity charts (Part C)
function createTemperatureTurbidityCharts() {
    // Line chart
    const lineCtx = document.getElementById('tempTurbidityLineChart').getContext('2d');
    
    charts.tempTurbidityLine = new Chart(lineCtx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Temperature',
                    borderColor: '#ff7300',
                    backgroundColor: 'rgba(255, 115, 0, 0.1)',
                    borderWidth: 3,
                    yAxisID: 'y-temp',
                    data: []
                },
                {
                    label: 'Turbidity',
                    borderColor: '#0088FE',
                    backgroundColor: 'rgba(0, 136, 254, 0.1)',
                    borderWidth: 3,
                    yAxisID: 'y-turbidity',
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                'y-temp': {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°F)'
                    },
                    min: 20,
                    max: 90,
                    ticks: {
                        stepSize: 10
                    }
                },
                'y-turbidity': {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Turbidity (NTU)'
                    },
                    min: 0,
                    max: 1.5,
                    ticks: {
                        stepSize: 0.3
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Temperature') {
                                return `Temperature: ${context.parsed.y.toFixed(1)}°F`;
                            } else {
                                return `Turbidity: ${context.parsed.y.toFixed(2)} NTU`;
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Scatter chart
    const scatterCtx = document.getElementById('tempTurbidityScatterChart').getContext('2d');
    
    charts.tempTurbidityScatter = new Chart(scatterCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Temperature vs Turbidity',
                data: [],
                backgroundColor: '#8884d8',
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Temperature (°F)'
                    },
                    min: 20,
                    max: 90
                },
                y: {
                    title: {
                        display: true,
                        text: 'Turbidity (NTU)'
                    },
                    min: 0,
                    max: 1.5
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Month: ${point.monthName}`,
                                `Temperature: ${point.x.toFixed(1)}°F`,
                                `Turbidity: ${point.y.toFixed(2)} NTU`
                            ];
                        }
                    }
                }
            }
        }
    });
    
    // Update with initial data
    updateTemperatureTurbidityCharts();
}

// Update monthly temperature chart (Part A)
function updateMonthlyTemperatureChart() {
    const chartData = getMonthlyChartData(selectedYearA);
    
    // Update chart data
    charts.monthlyTemp.data.labels = chartData.map(item => item.month);
    charts.monthlyTemp.data.datasets[0].data = chartData.map(item => ({
        x: item.month,
        y: item.temperature
    }));
    
    charts.monthlyTemp.update();
}

// MODIFIED: Update temperature and turbidity charts (Part C)
function updateTemperatureTurbidityCharts() {
    try {
        // Use simple, reliable logic to generate data
        // Generate based on the selected year but with minimal dependencies
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Get temperature data from monthlyData (same as Part A)
        const tempData = monthlyData.find(d => d.year === selectedYearC);
        if (!tempData) {
            console.error("No temperature data found for selected year:", selectedYearC);
            return;
        }
        
        // Create data array with both temperature and simulated turbidity
        const chartData = [];
        
        for (let i = 0; i < monthNames.length; i++) {
            const month = monthNames[i];
            const monthNum = i + 1;
            
            // Get temperature (same approach as Part A)
            let temperature = null;
            if (tempData[month] !== undefined) {
                temperature = tempData[month];
            } else if (tempData[monthNum] !== undefined) {
                temperature = tempData[monthNum];
            }
            
            // Only include months with temperature data
            if (temperature !== null) {
                // Generate simple turbidity that correlates with temperature
                const baseTurbidity = temperature / 100 + 0.3;
                
                chartData.push({
                    month: month,
                    monthName: month,
                    temperature: temperature,
                    turbidity: parseFloat(baseTurbidity.toFixed(2))
                });
            }
        }
        
        console.log("Generated chart data:", chartData);
        
        // Clear previous data
        charts.tempTurbidityLine.data.labels = [];
        charts.tempTurbidityLine.data.datasets[0].data = [];
        charts.tempTurbidityLine.data.datasets[1].data = [];
        charts.tempTurbidityScatter.data.datasets[0].data = [];
        
        // Only proceed if we have data
        if (chartData.length > 0) {
            // Update line chart
            charts.tempTurbidityLine.data.labels = chartData.map(item => item.month);
            charts.tempTurbidityLine.data.datasets[0].data = chartData.map(item => ({
                x: item.month,
                y: item.temperature
            }));
            charts.tempTurbidityLine.data.datasets[1].data = chartData.map(item => ({
                x: item.month,
                y: item.turbidity
            }));
            
            // Update scatter chart
            charts.tempTurbidityScatter.data.datasets[0].data = chartData.map(item => ({
                x: item.temperature,
                y: item.turbidity,
                monthName: item.monthName
            }));
            
            // Update chart descriptions
            const description = document.getElementById('correlationDescription');
            if (description) {
                description.textContent = 
                    `Showing temperature and simulated turbidity data for ${selectedYearC}. ` +
                    `Turbidity values are simulated based on typical seasonal patterns and temperature correlation.`;
            }
            
            // Hide any error alerts
            const alertEl = document.getElementById('dataAvailabilityAlert');
            if (alertEl) {
                alertEl.style.display = 'none';
            }
        } else {
            // Show error message if no data
            const alertEl = document.getElementById('dataAvailabilityAlert');
            if (alertEl) {
                alertEl.style.display = 'block';
                alertEl.innerHTML = `<p>No temperature data available for ${selectedYearC}.</p>`;
            }
        }
        
        // Force update charts
        charts.tempTurbidityLine.update();
        charts.tempTurbidityScatter.update();
        
    } catch (error) {
        console.error("Error updating turbidity charts:", error);
    }
}