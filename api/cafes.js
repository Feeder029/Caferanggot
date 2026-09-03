export async function POST(request) {
    try {
        const body = await request.json();

        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);

        let radius = Number(body.radius);

        if (!Number.isFinite(radius)) {
            radius = 3000;
        }

        radius = Math.min(Math.max(radius, 500), 5000);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return Response.json(
                {
                    error: "Invalid location data"
                },
                { status: 400 }
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
        }, 12000);

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

            return Response.json(
                {
                    error: "Overpass API error",
                    status: overpassResponse.status,
                    details: errorText
                },
                { status: 502 }
            );
        }

        const data = await overpassResponse.json();

        return Response.json(data, {
            status: 200,
            headers: {
                "Cache-Control": "public, max-age=60"
            }
        });

    } catch (error) {

        if (error.name === "AbortError") {
            return Response.json(
                {
                    error:
                        "Cafe search timed out. Please try again."
                },
                { status: 504 }
            );
        }

        return Response.json(
            {
                error: "Server error",
                details: error.message
            },
            { status: 500 }
        );
    }
}