// ============================================================
// STATE
// ============================================================

const device = document.getElementById('device');

function setState(state) {
    device.dataset.state = state;
}


// ============================================================
// ELEMENTS
// ============================================================

const btnWelcome = document.getElementById('btnWelcome');
const btnReady = document.getElementById('btnReady');
const btnCancelReady = document.getElementById('btnCancelReady');
const btnReset = document.getElementById('btnReset');

const cafeList = document.getElementById('cafeList');

const scrim = document.getElementById('scrim');
const sheet = document.getElementById('sheet');

const sheetSignal = document.getElementById('sheetSignal');
const sheetName = document.getElementById('sheetName');
const sheetWalk = document.getElementById('sheetWalk');
const sheetStatus = document.getElementById('sheetStatus');
const sheetDesc = document.getElementById('sheetDesc');
const sheetTags = document.getElementById('sheetTags');
const sheetStreet = document.getElementById('sheetStreet');

const sheetClose = document.getElementById('sheetClose');
const directionsBtn = document.querySelector('.sheet-footer .pill');


// ============================================================
// CURRENT LOCATION
// ============================================================

let userLatitude = null;
let userLongitude = null;


// ============================================================
// CURRENT SELECTED CAFE
// ============================================================

let selectedCafe = null;


// ============================================================
// WELCOME → READY
// ============================================================

btnWelcome.addEventListener('click', () => {
    setState('ready');
});


// ============================================================
// READY → WELCOME
// ============================================================

btnCancelReady.addEventListener('click', () => {
    setState('welcome');
});


// ============================================================
// START SEARCH
// ============================================================

btnReady.addEventListener('click', () => {

    setState('listening');

    getUserLocation();

});


// ============================================================
// GET USER LOCATION
// ============================================================

function getUserLocation() {

    if (!navigator.geolocation) {

        showLocationError(
            'Geolocation is not supported by your browser.'
        );

        return;
    }


    navigator.geolocation.getCurrentPosition(

        // SUCCESS
        async (position) => {

            userLatitude = position.coords.latitude;
            userLongitude = position.coords.longitude;

            console.log('Latitude:', userLatitude);
            console.log('Longitude:', userLongitude);

            await searchCafes();

        },

        // ERROR
        (error) => {

            console.error('Location error:', error);

            let message = 'Unable to get your location.';

            if (error.code === 1) {
                message = 'Location permission was denied.';
            }

            if (error.code === 2) {
                message = 'Your location could not be determined.';
            }

            if (error.code === 3) {
                message = 'Location request timed out.';
            }

            showLocationError(message);

        },

        // OPTIONS
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }

    );

}


// ============================================================
// LOCATION ERROR
// ============================================================

function showLocationError(message) {

    alert(message);

    setState('welcome');

}


// ============================================================
// SEARCH CAFES
// ============================================================
//
// IMPORTANT:
//
// Replace the API URL below with the API you decide to use.
//
// Example:
// https://your-api.com/search
//
// The API should return cafe/place information.
//
// ============================================================

async function searchCafes() {

    try {

        /*
         * ------------------------------------------------------
         * REPLACE THIS URL
         * ------------------------------------------------------
         */

        const API_URL = 'YOUR_API_URL_HERE';


        /*
         * ------------------------------------------------------
         * CREATE REQUEST URL
         * ------------------------------------------------------
         */

        const url =
            `${API_URL}?latitude=${userLatitude}` +
            `&longitude=${userLongitude}` +
            `&radius=2000`;


        console.log('Searching:', url);


        /*
         * ------------------------------------------------------
         * CALL API
         * ------------------------------------------------------
         */

        const response = await fetch(url);


        if (!response.ok) {

            throw new Error(
                `API request failed: ${response.status}`
            );

        }


        /*
         * ------------------------------------------------------
         * GET JSON
         * ------------------------------------------------------
         */

        const data = await response.json();


        console.log('API response:', data);


        /*
         * ------------------------------------------------------
         * CONVERT API DATA
         * ------------------------------------------------------
         */

        const cafes = convertApiData(data);


        /*
         * ------------------------------------------------------
         * DISPLAY RESULTS
         * ------------------------------------------------------
         */

        displayCafes(cafes);


        /*
         * ------------------------------------------------------
         * RESULTS STATE
         * ------------------------------------------------------
         */

        setState('results');


    } catch (error) {

        console.error('Cafe search error:', error);

        alert(
            'Something went wrong while searching for cafés.'
        );

        setState('welcome');

    }

}


// ============================================================
// CONVERT API DATA
// ============================================================
//
// Different APIs return different JSON structures.
//
// This function converts the API response into the format
// Caferanggot uses.
//
// You may need to change this depending on your API.
// ============================================================

function convertApiData(data) {

    /*
     * Example expected API response:
     *
     * {
     *     cafes: [
     *         {
     *             id: "123",
     *             name: "Coffee Shop",
     *             latitude: 15.123,
     *             longitude: 120.123,
     *             address: "123 Main Street",
     *             open: true
     *         }
     *     ]
     * }
     */


    if (!data || !Array.isArray(data.cafes)) {

        console.warn(
            'API response does not contain a cafes array.'
        );

        return [];

    }


    return data.cafes.map(cafe => {

        const distance = calculateDistance(
            userLatitude,
            userLongitude,
            cafe.latitude,
            cafe.longitude
        );


        return {

            id: cafe.id,

            name: cafe.name || 'Unnamed Café',

            latitude: cafe.latitude,

            longitude: cafe.longitude,

            address:
                cafe.address ||
                'Address unavailable',

            open:
                cafe.open ?? null,

            distance: distance,

            distanceText:
                formatDistance(distance),

            description:
                cafe.description ||
                'No description available.',

            tags:
                cafe.tags ||
                ['Coffee'],

            signal:
                getSignal(distance)

        };

    });

}


// ============================================================
// DISPLAY CAFES
// ============================================================

function displayCafes(cafes) {

    cafeList.innerHTML = '';


    /*
     * No results
     */

    if (cafes.length === 0) {

        cafeList.innerHTML = `
            <p style="
                text-align:center;
                color:var(--cream-dim);
                padding:30px 0;
            ">
                No cafés found nearby.
            </p>
        `;

        updateResultsHeading(0);

        return;
    }


    /*
     * Sort closest first
     */

    cafes.sort((a, b) => {
        return a.distance - b.distance;
    });


    /*
     * Limit results
     */

    const limitedCafes = cafes.slice(0, 10);


    /*
     * Update heading
     */

    updateResultsHeading(limitedCafes.length);


    /*
     * Create cards
     */

    limitedCafes.forEach(cafe => {

        const card = createCafeCard(cafe);

        cafeList.appendChild(card);

    });

}


// ============================================================
// UPDATE RESULTS HEADING
// ============================================================

function updateResultsHeading(count) {

    const heading =
        document.querySelector('.results-head h1');

    if (!heading) return;


    if (count === 0) {

        heading.textContent =
            'No cafés found';

        return;
    }


    heading.textContent =
        `${count} café${count !== 1 ? 's' : ''} listening back`;

}


// ============================================================
// CREATE CAFE CARD
// ============================================================

function createCafeCard(cafe) {

    const card =
        document.createElement('button');

    card.className = 'cafe-card';

    card.type = 'button';


    /*
     * SIGNAL
     */

    const signal =
        document.createElement('div');

    signal.className =
        `signal s${cafe.signal}`;

    signal.setAttribute(
        'aria-hidden',
        'true'
    );


    for (let i = 0; i < 4; i++) {

        const bar =
            document.createElement('i');

        signal.appendChild(bar);

    }


    /*
     * INFO
     */

    const info =
        document.createElement('div');

    info.className = 'cafe-info';


    const name =
        document.createElement('p');

    name.className = 'cafe-name';

    name.textContent = cafe.name;


    const meta =
        document.createElement('p');

    meta.className = 'cafe-meta';

    meta.textContent =
        cafe.distanceText;


    info.appendChild(name);
    info.appendChild(meta);


    /*
     * STATUS
     */

    const status =
        document.createElement('span');

    status.className = 'status-badge';


    if (cafe.open === true) {

        status.classList.add('open');

        status.textContent =
            'Open now';

    }

    else if (cafe.open === false) {

        status.textContent =
            'Closed';

    }

    else {

        status.textContent =
            'Hours unavailable';

    }


    /*
     * BUILD CARD
     */

    card.appendChild(signal);
    card.appendChild(info);
    card.appendChild(status);


    /*
     * CLICK
     */

    card.addEventListener('click', () => {

        openSheet(cafe);

    });


    return card;

}


// ============================================================
// OPEN CAFE DETAIL SHEET
// ============================================================

function openSheet(cafe) {

    if (!cafe) return;


    selectedCafe = cafe;


    /*
     * Name
     */

    sheetName.textContent =
        cafe.name;


    /*
     * Distance
     */

    sheetWalk.textContent =
        cafe.distanceText;


    /*
     * Description
     */

    sheetDesc.textContent =
        cafe.description;


    /*
     * Address
     */

    sheetStreet.textContent =
        cafe.address;


    /*
     * Status
     */

    if (cafe.open === true) {

        sheetStatus.textContent =
            'Open now';

        sheetStatus.classList.add('open');

    }

    else if (cafe.open === false) {

        sheetStatus.textContent =
            'Closed';

        sheetStatus.classList.remove('open');

    }

    else {

        sheetStatus.textContent =
            'Hours unavailable';

        sheetStatus.classList.remove('open');

    }


    /*
     * Signal
     */

    sheetSignal.className =
        `signal s${cafe.signal}`;


    /*
     * Tags
     */

    sheetTags.innerHTML = '';


    cafe.tags.forEach(tag => {

        const span =
            document.createElement('span');

        span.className = 'tag';

        span.textContent = tag;

        sheetTags.appendChild(span);

    });


    /*
     * Show sheet
     */

    scrim.classList.add('show');

    sheet.classList.add('show');


    /*
     * Focus close button
     */

    sheetClose.focus();

}


// ============================================================
// CLOSE DETAIL SHEET
// ============================================================

function closeSheet() {

    scrim.classList.remove('show');

    sheet.classList.remove('show');

    selectedCafe = null;

}


// ============================================================
// CLOSE BUTTON
// ============================================================

sheetClose.addEventListener(
    'click',
    closeSheet
);


// ============================================================
// CLICK SCRIM
// ============================================================

scrim.addEventListener(
    'click',
    closeSheet
);


// ============================================================
// ESC KEY
// ============================================================

document.addEventListener('keydown', (event) => {

    if (
        event.key === 'Escape' &&
        sheet.classList.contains('show')
    ) {

        closeSheet();

    }

});


// ============================================================
// GET DIRECTIONS
// ============================================================

directionsBtn.addEventListener('click', () => {

    if (!selectedCafe) return;


    if (
        selectedCafe.latitude == null ||
        selectedCafe.longitude == null
    ) {

        alert(
            'Directions are unavailable for this café.'
        );

        return;

    }


    const url =
        `https://www.google.com/maps/dir/?api=1` +
        `&origin=${userLatitude},${userLongitude}` +
        `&destination=${selectedCafe.latitude},${selectedCafe.longitude}`;


    window.open(url, '_blank');

});


// ============================================================
// SEARCH AGAIN
// ============================================================

btnReset.addEventListener('click', () => {

    cafeList.innerHTML = '';

    selectedCafe = null;

    setState('welcome');

});


// ============================================================
// DISTANCE CALCULATION
// ============================================================
//
// Haversine formula
//
// Returns distance in kilometers.
// ============================================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius = 6371;


    const dLat =
        toRadians(lat2 - lat1);

    const dLon =
        toRadians(lon2 - lon1);


    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;


    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return earthRadius * c;

}


// ============================================================
// DEGREES → RADIANS
// ============================================================

function toRadians(degrees) {

    return degrees * (Math.PI / 180);

}


// ============================================================
// FORMAT DISTANCE
// ============================================================

function formatDistance(distanceKm) {

    if (distanceKm < 1) {

        const meters =
            Math.round(distanceKm * 1000);

        return `About ${meters} m away`;

    }


    return `About ${distanceKm.toFixed(1)} km away`;

}


// ============================================================
// SIGNAL STRENGTH
// ============================================================
//
// Just a visual representation based on distance.
// ============================================================

function getSignal(distanceKm) {

    if (distanceKm <= 0.5) {
        return 4;
    }

    if (distanceKm <= 1) {
        return 3;
    }

    if (distanceKm <= 2) {
        return 2;
    }

    return 1;

}