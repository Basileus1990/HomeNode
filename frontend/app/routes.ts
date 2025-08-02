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
        layout("./host/pages/layout.tsx", [
            index("./host/pages/main/main.tsx"),  // default view - share new item or view shared items
            route("share", "./host/pages/share-new/share.tsx"), // share new item
            route("shared/:id?", "./host/pages/shared-list/shared-list.tsx"),  // view shared items
        ]),
    ]),


    // client routes
    ...prefix("client", [
        index("./client/pages/main/main.tsx"),    // default route, will be empty or redirect to some list view
        route(":id", "./client/pages/view-item/view-item.tsx"), // dynamic route to view a specific item
    ])
] satisfies RouteConfig;
