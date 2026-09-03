const device = document.getElementById("device");

const setState = (state) => {
    device.dataset.state = state;
};

const btnWelcome = document.getElementById("btnWelcome");
const btnReady = document.getElementById("btnReady");
const btnCancelReady = document.getElementById("btnCancelReady");
const btnReset = document.getElementById("btnReset");

const cafeList = document.querySelector(".cafe-list");
const resultsHead = document.querySelector(".results-head");

const scrim = document.getElementById("scrim");
const sheet = document.getElementById("sheet");
const sheetSignal = document.getElementById("sheetSignal");
const sheetName = document.getElementById("sheetName");
const sheetWalk = document.getElementById("sheetWalk");
const sheetStatus = document.getElementById("sheetStatus");
const sheetDesc = document.getElementById("sheetDesc");
const sheetTags = document.getElementById("sheetTags");
const sheetStreet = document.getElementById("sheetStreet");
const sheetClose = document.getElementById("sheetClose");

let userLatitude = null;
let userLongitude = null;
let cafes = [];
let lastFocused = null;
let selectedCafe = null;

btnWelcome.addEventListener("click", () => {
    setState("ready");
});

btnReady.addEventListener("click", () => {
    setState("listening");
    findNearbyCafes();
});

btnCancelReady.addEventListener("click", () => {
    setState("welcome");
});

btnReset.addEventListener("click", () => {
    closeSheet();
    setState("welcome");
});

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(
                new Error(
                    "Geolocation is not supported by this browser."
                )
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLatitude = position.coords.latitude;
                userLongitude = position.coords.longitude;

                resolve({
                    latitude: userLatitude,
                    longitude: userLongitude
                });
            },
            (error) => {
                let message = "Unable to get your location.";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = "Location permission was denied.";
                        break;

                    case error.POSITION_UNAVAILABLE:
                        message =
                            "Your location is currently unavailable.";
                        break;

                    case error.TIMEOUT:
                        message = "Location request timed out.";
                        break;
                }

                reject(new Error(message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    });
}

async function findNearbyCafes() {
    try {
        const location = await getUserLocation();
        const radius = 3000;

        const response = await fetch("/api/cafes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
                radius: radius
            })
        });

        if (!response.ok) {
            let errorMessage = `Cafe search failed: ${response.status}`;

            try {
                const errorData = await response.json();

                if (errorData.details) {
                    errorMessage = errorData.details;
                } else if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch {
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.elements || !Array.isArray(data.elements)) {
            throw new Error("Invalid response from cafe search.");
        }

        cafes = data.elements
            .map(convertOverpassCafe)
            .filter(Boolean)
            .map((cafe) => {
                cafe.distance = calculateDistance(
                    userLatitude,
                    userLongitude,
                    cafe.latitude,
                    cafe.longitude
                );

                return cafe;
            });

        cafes.sort((a, b) => a.distance - b.distance);

        cafes = removeDuplicates(cafes);

        cafes = cafes.slice(0, 20);

        renderCafes();
        setState("results");

    } catch (error) {
        console.error("Cafe search error:", error);

        showSearchError(error.message);

        setState("results");
    }
}

function convertOverpassCafe(element) {
    const tags = element.tags || {};

    let latitude = element.lat;
    let longitude = element.lon;

    if (
        latitude === undefined &&
        element.center
    ) {
        latitude = element.center.lat;
        longitude = element.center.lon;
    }

    if (
        latitude === undefined ||
        longitude === undefined
    ) {
        return null;
    }

    const name = tags.name;

    if (!name) {
        return null;
    }

    return {
        id: `${element.type}-${element.id}`,
        name: name,
        latitude: latitude,
        longitude: longitude,
        address: buildAddress(tags),
        openingHours: tags.opening_hours || null,
        phone:
            tags.phone ||
            tags["contact:phone"] ||
            null,
        website:
            tags.website ||
            tags["contact:website"] ||
            null,
        cuisine: tags.cuisine || null,
        outdoorSeating:
            tags.outdoor_seating === "yes",
        wheelchair:
            tags.wheelchair || null,
        rawTags: tags
    };
}

function buildAddress(tags) {
    const parts = [];

    if (tags["addr:housenumber"]) {
        parts.push(tags["addr:housenumber"]);
    }

    if (tags["addr:street"]) {
        parts.push(tags["addr:street"]);
    }

    if (tags["addr:suburb"]) {
        parts.push(tags["addr:suburb"]);
    }

    if (tags["addr:city"]) {
        parts.push(tags["addr:city"]);
    }

    if (tags["addr:postcode"]) {
        parts.push(tags["addr:postcode"]);
    }

    if (parts.length === 0) {
        return "Address not available";
    }

    return parts.join(", ");
}

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {
    const earthRadius = 6371;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        const meters = Math.round(
            distanceKm * 1000
        );

        return `${meters} m away`;
    }

    return `${distanceKm.toFixed(1)} km away`;
}

function formatWalkingDistance(distanceKm) {
    const minutes = Math.max(
        1,
        Math.round(distanceKm / 5 * 60)
    );

    return `About ${minutes} minutes on foot`;
}

function getCafeStatus(cafe) {
    if (!cafe.openingHours) {
        return {
            text: "Hours unavailable",
            open: false,
            known: false
        };
    }

    const status = parseOpeningHours(
        cafe.openingHours
    );

    if (status === true) {
        return {
            text: "Open now",
            open: true,
            known: true
        };
    }

    if (status === false) {
        return {
            text: "Closed",
            open: false,
            known: true
        };
    }

    return {
        text: "Hours available",
        open: false,
        known: false
    };
}

function parseOpeningHours(value) {
    const hours = value
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    if (
        hours === "24/7" ||
        hours === "24 hours" ||
        hours === "open 24 hours"
    ) {
        return true;
    }

    if (
        hours.includes("closed") &&
        !/\d{1,2}[:.]\d{2}/.test(hours)
    ) {
        return false;
    }

    const now = new Date();
    const day = now.getDay();

    const dayNames = [
        "su",
        "mo",
        "tu",
        "we",
        "th",
        "fr",
        "sa"
    ];

    const sections = hours.split(";");

    let foundDayRule = false;
    let currentDayRule = null;

    for (const section of sections) {
        const cleanSection = section.trim();

        if (!cleanSection) {
            continue;
        }

        const dayMatch = cleanSection.match(
            /^(mo|tu|we|th|fr|sa|su)(?:\s*-\s*(mo|tu|we|th|fr|sa|su))?\s+/i
        );

        if (dayMatch) {
            const startDay =
                dayNames.indexOf(
                    dayMatch[1].toLowerCase()
                );

            const endDay = dayMatch[2]
                ? dayNames.indexOf(
                    dayMatch[2].toLowerCase()
                )
                : startDay;

            const applies =
                startDay <= endDay
                    ? day >= startDay &&
                      day <= endDay
                    : day >= startDay ||
                      day <= endDay;

            if (applies) {
                foundDayRule = true;

                currentDayRule = cleanSection
                    .replace(dayMatch[0], "")
                    .trim();
            }

            continue;
        }

        if (
            !foundDayRule &&
            sections.length === 1
        ) {
            currentDayRule = cleanSection;
        }
    }

    if (!currentDayRule) {
        return null;
    }

    if (currentDayRule.includes("closed")) {
        return false;
    }

    if (
        currentDayRule.includes("open") &&
        !/\d{1,2}[:.]\d{2}/.test(
            currentDayRule
        )
    ) {
        return true;
    }

    const timeRanges =
        currentDayRule.match(
            /\d{1,2}(?::|\.)?\d{0,2}\s*-\s*\d{1,2}(?::|\.)?\d{0,2}/g
        );

    if (
        !timeRanges ||
        timeRanges.length === 0
    ) {
        return null;
    }

    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    for (const range of timeRanges) {
        const parts = range.split("-");

        if (parts.length !== 2) {
            continue;
        }

        const start = parseTime(parts[0]);
        const end = parseTime(parts[1]);

        if (
            start === null ||
            end === null
        ) {
            continue;
        }

        if (end < start) {
            if (
                currentMinutes >= start ||
                currentMinutes <= end
            ) {
                return true;
            }
        } else if (
            currentMinutes >= start &&
            currentMinutes <= end
        ) {
            return true;
        }
    }

    return false;
}

function parseTime(value) {
    const clean = value
        .trim()
        .replace(".", ":");

    const parts = clean.split(":");

    let hour = parseInt(
        parts[0],
        10
    );

    let minute = parts[1]
        ? parseInt(parts[1], 10)
        : 0;

    if (
        Number.isNaN(hour) ||
        Number.isNaN(minute) ||
        hour > 24 ||
        minute > 59
    ) {
        return null;
    }

    if (hour === 24) {
        hour = 0;
    }

    return hour * 60 + minute;
}

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

function getCafeTags(cafe) {
    const tags = [];

    if (cafe.cuisine) {
        cafe.cuisine
            .split(";")
            .slice(0, 2)
            .forEach((item) => {
                tags.push(
                    item
                        .replaceAll("_", " ")
                        .trim()
                );
            });
    }

    if (cafe.outdoorSeating) {
        tags.push("Outdoor seats");
    }

    if (cafe.wheelchair === "yes") {
        tags.push(
            "Wheelchair accessible"
        );
    }

    if (tags.length === 0) {
        tags.push("Cafe");
    }

    return tags.slice(0, 3);
}

function removeDuplicates(list) {
    const seen = new Set();

    return list.filter((cafe) => {
        const key =
            `${cafe.name.toLowerCase()}-${cafe.latitude.toFixed(5)}-${cafe.longitude.toFixed(5)}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}

function renderCafes() {
    cafeList.innerHTML = "";

    if (cafes.length === 0) {
        cafeList.innerHTML = `
            <div class="empty-state">
                <p>No cafés found nearby.</p>
                <small>
                    Try searching again or move to another area.
                </small>
            </div>
        `;

        updateResultsHeader(0);

        return;
    }

    updateResultsHeader(cafes.length);

    cafes.forEach((cafe) => {
        const card =
            createCafeCard(cafe);

        cafeList.appendChild(card);
    });
}

function createCafeCard(cafe) {
    const button =
        document.createElement("button");

    button.type = "button";
    button.className = "cafe-card";
    button.dataset.id = cafe.id;

    const signal =
        getSignal(cafe.distance);

    const status =
        getCafeStatus(cafe);

    button.innerHTML = `
        <span
            class="signal s${signal}"
            aria-hidden="true"
        >
            <i></i>
            <i></i>
            <i></i>
            <i></i>
        </span>

        <span class="cafe-info">
            <strong class="cafe-name">
                ${escapeHTML(cafe.name)}
            </strong>

            <span class="cafe-meta">
                ${escapeHTML(
                    formatDistance(
                        cafe.distance
                    )
                )}
            </span>
        </span>

        <span
            class="status-badge ${
                status.open ? "open" : ""
            }"
        >
            ${escapeHTML(status.text)}
        </span>
    `;

    button.addEventListener(
        "click",
        () => {
            lastFocused = button;
            openSheet(cafe);
        }
    );

    return button;
}

function updateResultsHeader(count) {
    if (!resultsHead) {
        return;
    }

    if (count === 1) {
        resultsHead.textContent =
            "1 café searched";

        return;
    }

    resultsHead.textContent =
        `${count} cafés searched`;
}

function openSheet(cafe) {
    selectedCafe = cafe;

    const signal =
        getSignal(cafe.distance);

    const status =
        getCafeStatus(cafe);

    sheetName.textContent =
        cafe.name;

    sheetWalk.textContent =
        formatWalkingDistance(
            cafe.distance
        );

    sheetStatus.textContent =
        status.text;

    sheetStatus.classList.toggle(
        "open",
        status.open
    );

    sheetSignal.className =
        `signal s${signal}`;

    sheetDesc.textContent =
        cafe.address ||
        "Address not available";

    if (cafe.openingHours) {
        sheetStreet.textContent =
            cafe.openingHours;
    } else {
        sheetStreet.textContent =
            formatDistance(
                cafe.distance
            );
    }

    sheetTags.innerHTML = "";

    const tags =
        getCafeTags(cafe);

    tags.forEach((tag) => {
        const span =
            document.createElement("span");

        span.className = "tag";
        span.textContent = tag;

        sheetTags.appendChild(span);
    });

    setupDirectionsButton(cafe);

    scrim.classList.add("show");
    sheet.classList.add("show");

    sheetClose.focus();
}

function setupDirectionsButton(cafe) {
    const directionsButton =
        document.querySelector(
            ".sheet-footer .pill.small"
        );

    if (!directionsButton) {
        return;
    }

    directionsButton.onclick = () => {
        const url =
            `https://www.google.com/maps/dir/?api=1` +
            `&origin=${userLatitude},${userLongitude}` +
            `&destination=${cafe.latitude},${cafe.longitude}`;

        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );
    };
}

function closeSheet() {
    scrim.classList.remove("show");
    sheet.classList.remove("show");

    if (lastFocused) {
        lastFocused.focus();
    }

    selectedCafe = null;
}

sheetClose.addEventListener(
    "click",
    closeSheet
);

scrim.addEventListener(
    "click",
    closeSheet
);

document.addEventListener(
    "keydown",
    (event) => {
        if (
            event.key === "Escape" &&
            sheet.classList.contains("show")
        ) {
            closeSheet();
        }
    }
);

function showSearchError(message) {
    console.error(message);

    cafeList.innerHTML = `
        <div class="empty-state">
            <p>Search failed.</p>
            <small>
                Check your internet connection or
                location settings if turned on and try again.
            </small>
        </div>
    `;

    updateResultsHeader(0);
}

function escapeHTML(value) {
    const div =
        document.createElement("div");

    div.textContent =
        String(value ?? "");

    return div.innerHTML;
}