export default async function handler(request) {
    try {
        // TEST 1
        if (request.method !== "POST") {
            return Response.json(
                {
                    step: "method",
                    method: request.method,
                    message: "Use POST"
                },
                { status: 405 }
            );
        }

        // TEST 2
        const body = await request.json();

        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);
        const radius = Number(body.radius) || 3000;

        // TEST 3
        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return Response.json(
                {
                    step: "coordinates",
                    error: "Invalid coordinates"
                },
                { status: 400 }
            );
        }

        // TEST 4 - DON'T CALL OVERPASS YET
        return Response.json({
            step: "before-overpass",
            message: "Vercel API works",
            latitude,
            longitude,
            radius
        });

    } catch (error) {
        return Response.json(
            {
                step: "catch",
                error: error.message
            },
            { status: 500 }
        );
    }
}