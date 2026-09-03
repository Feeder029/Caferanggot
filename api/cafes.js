export default async function handler(request) {
    return new Response(
        JSON.stringify({
            message: "Caferanggot API is working",
            method: request.method
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
}