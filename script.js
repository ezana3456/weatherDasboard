
// API Key for OpenWeatherMap (replace with your own key)
const API_KEY = 'c966d887c52aeafff2f2d708690b13b2';
let map;
let marker;
let searchHistory = JSON.parse(localStorage.getItem('weatherSearchHistory')) || [];

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadSearchHistory();
    
    // Event listeners
    document.getElementById('searchBtn').addEventListener('click', searchLocation);
    document.getElementById('currentLocationBtn').addEventListener('click', getCurrentLocation);
    document.getElementById('locationInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchLocation();
        }
    });
    
    // Load last searched location if available
    if (searchHistory.length > 0) {
        fetchWeather(searchHistory[0]);
    }
});

// Initialize the map
function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Click event on map to get location
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        updateMapMarker(lat, lon);
        fetchWeatherByCoords(lat, lon);
    });
}

// Update map marker
function updateMapMarker(lat, lon) {
    if (marker) {
        map.removeLayer(marker);
    }
    marker = L.marker([lat, lon]).addTo(map);
    map.setView([lat, lon], 10);
}

// Get user's current location
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                updateMapMarker(lat, lon);
                fetchWeatherByCoords(lat, lon);
            },
            function(error) {
                alert('Unable to get your location: ' + error.message);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

// Search for a location
function searchLocation() {
    const location = document.getElementById('locationInput').value.trim();
    if (location) {
        fetchWeather(location);
    } else {
        alert('Please enter a location');
    }
}

// Fetch weather data by city name
function fetchWeather(city) {
    // First get coordinates for the city
    fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                updateMapMarker(lat, lon);
                
                // Add to search history
                addToSearchHistory(city);
                
                // Fetch weather data
                fetchWeatherData(lat, lon, city);
            } else {
                alert('Location not found');
            }
        })
        .catch(error => {
            console.error('Error fetching location data:', error);
            alert('Error fetching location data');
        });
}

// Fetch weather data by coordinates
function fetchWeatherByCoords(lat, lon) {
    // Reverse geocoding to get city name
    fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const city = data[0].name;
                document.getElementById('locationInput').value = city;
                
                // Add to search history
                addToSearchHistory(city);
                
                // Fetch weather data
                fetchWeatherData(lat, lon, city);
            }
        })
        .catch(error => {
            console.error('Error fetching reverse geocoding data:', error);
        });
}

// Fetch weather and forecast data
function fetchWeatherData(lat, lon, city) {
    // Current weather
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            displayCurrentWeather(data, city);
        })
        .catch(error => {
            console.error('Error fetching current weather:', error);
            alert('Error fetching current weather data');
        });
    
    // 5-day forecast
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            displayForecast(data);
        })
        .catch(error => {
            console.error('Error fetching forecast:', error);
            alert('Error fetching forecast data');
        });
}

// Display current weather
function displayCurrentWeather(data, city) {
    document.getElementById('currentCity').textContent = city;
    document.getElementById('currentDate').textContent = moment.unix(data.dt).format('dddd, MMMM Do YYYY');
    document.getElementById('currentDescription').textContent = data.weather[0].description;
    document.getElementById('currentTemp').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('currentHumidity').textContent = data.main.humidity;
    document.getElementById('currentWind').textContent = Math.round(data.wind.speed * 3.6); // Convert m/s to km/h
    document.getElementById('currentPressure').textContent = data.main.pressure;
    
    // Set weather icon
    const icon = getWeatherIcon(data.weather[0].icon);
    document.getElementById('currentWeatherIcon').className = `fas fa-${icon} weather-icon`;
}

// Display 5-day forecast
function displayForecast(data) {
    const forecastContainer = document.getElementById('forecastContainer');
    forecastContainer.innerHTML = '';
    
    // We get data for every 3 hours, so we'll take one reading per day (at noon)
    const dailyForecasts = [];
    for (let i = 0; i < data.list.length; i++) {
        const forecast = data.list[i];
        const forecastTime = moment.unix(forecast.dt).format('H');
        
        // Use forecast around noon (12:00)
        if (forecastTime === '12') {
            dailyForecasts.push(forecast);
            
            // Stop when we have 5 days
            if (dailyForecasts.length === 5) break;
        }
    }
    
    // If we didn't get noon forecasts, just take the first forecast of each day
    if (dailyForecasts.length < 5) {
        const dates = new Set();
        for (let i = 0; i < data.list.length; i++) {
            const forecast = data.list[i];
            const date = moment.unix(forecast.dt).format('YYYY-MM-DD');
            
            if (!dates.has(date)) {
                dates.add(date);
                dailyForecasts.push(forecast);
                
                if (dailyForecasts.length === 5) break;
            }
        }
    }
    
    // Create forecast cards
    dailyForecasts.forEach(forecast => {
        const date = moment.unix(forecast.dt);
        const icon = getWeatherIcon(forecast.weather[0].icon);
        
        const col = document.createElement('div');
        col.className = 'col-md-2 col-sm-4 col-6 mb-3';
        
        col.innerHTML = `
            <div class="card weather-card forecast-card h-100">
                <div class="card-body text-center">
                    <h5 class="card-title">${date.format('ddd')}</h5>
                    <p class="card-text">${date.format('MMM D')}</p>
                    <i class="fas fa-${icon} weather-icon mb-2"></i>
                    <p class="mb-1">${Math.round(forecast.main.temp_max)}°C / ${Math.round(forecast.main.temp_min)}°C</p>
                    <p class="mb-1 small">${forecast.weather[0].description}</p>
                    <p class="mb-1 small">Humidity: ${forecast.main.humidity}%</p>
                </div>
            </div>
        `;
        
        forecastContainer.appendChild(col);
    });
}

// Add to search history
function addToSearchHistory(city) {
    // Remove if already exists
    searchHistory = searchHistory.filter(item => item.toLowerCase() !== city.toLowerCase());
    
    // Add to beginning of array
    searchHistory.unshift(city);
    
    // Keep only last 10 searches
    if (searchHistory.length > 10) {
        searchHistory.pop();
    }
    
    // Save to localStorage
    localStorage.setItem('weatherSearchHistory', JSON.stringify(searchHistory));
    
    // Update UI
    loadSearchHistory();
}

// Load search history
function loadSearchHistory() {
    const historyList = document.getElementById('searchHistory');
    historyList.innerHTML = '';
    
    searchHistory.forEach(city => {
        const li = document.createElement('li');
        li.className = 'list-group-item search-history-item';
        li.textContent = city;
        li.addEventListener('click', function() {
            document.getElementById('locationInput').value = city;
            fetchWeather(city);
        });
        historyList.appendChild(li);
    });
}

// Map weather icons to Font Awesome icons
function getWeatherIcon(openWeatherIcon) {
    const iconMap = {
        '01d': 'sun',
        '01n': 'moon',
        '02d': 'cloud-sun',
        '02n': 'cloud-moon',
        '03d': 'cloud',
        '03n': 'cloud',
        '04d': 'cloud',
        '04n': 'cloud',
        '09d': 'cloud-rain',
        '09n': 'cloud-rain',
        '10d': 'cloud-sun-rain',
        '10n': 'cloud-moon-rain',
        '11d': 'bolt',
        '11n': 'bolt',
        '13d': 'snowflake',
        '13n': 'snowflake',
        '50d': 'smog',
        '50n': 'smog'
    };
    
    return iconMap[openWeatherIcon] || 'cloud';
}
