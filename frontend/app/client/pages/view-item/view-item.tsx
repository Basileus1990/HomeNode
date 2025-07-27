import type { Route } from "./+types/view-item.js";

export async function clientLoader({ params }: Route.LoaderArgs) {

    // Simulate a data fetch for the item with the given ID
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return {
        id: params.id,
        name: `Item ${params.id}`,
    };
}

export default function ViewItem({ loaderData, params }: Route.ComponentProps) {
    return (
        <div>
            <h1>View Item</h1>
            <p>Item ID: {params.id}</p>
            <p>{JSON.stringify(loaderData)}</p>
        </div>
    );
}
