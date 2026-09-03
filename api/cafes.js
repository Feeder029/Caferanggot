export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
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
        const radius = Number(body.radius) || 5000;

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(radius)
        ) {
            return new Response(
                JSON.stringify({ error: "Invalid location data" }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const query = `
            [out:json][timeout:25];

            (
                nwr["amenity"="cafe"]
                    (around:${radius},${latitude},${longitude});

                nwr["shop"="coffee"]
                    (around:${radius},${latitude},${longitude});

                nwr["name"~"coffee|cafe|café|kape|kapehan|brew|espresso|kopi|kaffee",i]
                    ["amenity"]
                    (around:${radius},${latitude},${longitude});

                nwr["name"~"coffee|cafe|café|kape|kapehan|brew|espresso|kopi|kaffee",i]
                    ["shop"]
                    (around:${radius},${latitude},${longitude});
            );

            out center tags;
        `;

        const overpassResponse = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Caferanggot/1.0"
                },
                body: new URLSearchParams({
                    data: query
                })
            }
        );

        if (!overpassResponse.ok) {
            const errorText = await overpassResponse.text();

            return new Response(
                JSON.stringify({
                    error: "Overpass API error",
                    status: overpassResponse.status,
                    details: errorText
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const data = await overpassResponse.json();

        return new Response(
            JSON.stringify(data),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=60"
                }
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: "Server error",
                details: error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}