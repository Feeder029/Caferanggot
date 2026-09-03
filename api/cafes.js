export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: "Method not allowed"
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }

    try {
        const body = await request.json();

        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);

        let radius = Number(body.radius);

        if (!Number.isFinite(radius)) {
            radius = 3000;
        }

        radius = Math.min(
            Math.max(radius, 500),
            5000
        );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return new Response(
                JSON.stringify({
                    error: "Invalid location data"
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const query = `
            [out:json][timeout:10];

            nwr["amenity"="cafe"]
                (around:${radius},${latitude},${longitude});

            out center tags;
        `;

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 8000);

        let overpassResponse;

        try {
            overpassResponse = await fetch(
                "https://overpass-api.de/api/interpreter",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                        "User-Agent":
                            "Caferanggot/1.0"
                    },
                    body: new URLSearchParams({
                        data: query
                    }),
                    signal: controller.signal
                }
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!overpassResponse.ok) {
            const errorText =
                await overpassResponse.text();

            return new Response(
                JSON.stringify({
                    error: "Overpass API error",
                    status: overpassResponse.status,
                    details: errorText
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        const data =
            await overpassResponse.json();

        return new Response(
            JSON.stringify(data),
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json",
                    "Cache-Control":
                        "public, max-age=60"
                }
            }
        );

    } catch (error) {
        if (error.name === "AbortError") {
            return new Response(
                JSON.stringify({
                    error:
                        "Cafe search timed out. Please try again."
                }),
                {
                    status: 504,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({
                error: "Server error",
                details: error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }
}