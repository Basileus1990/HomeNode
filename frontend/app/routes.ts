import {
    type RouteConfig,
    route,
    index,
    layout,
    prefix,
} from "@react-router/dev/routes";

export default [
    index("./home.tsx"),   // default index, to be changed

    // host routes
    ...prefix("host", [
        layout("./host/views/layout.tsx", [
            index("./host/views/main/main.tsx"),  // default view - share new item or view shared items
            route("share", "./host/views/share-new/share.tsx"), // share new item
            route("shared/:item_id?", "./host/views/shared-list/shared-list.tsx"),  // view shared items
        ]),
    ]),


    // client routes
    ...prefix("client", [
        index("./client/views/main/main.tsx"),    // default route, will be empty or redirect to some list view
        route(":host_id/:item_id", "./client/views/view-item/view-item.tsx"), // dynamic route to view a specific item
    ])
] satisfies RouteConfig;
