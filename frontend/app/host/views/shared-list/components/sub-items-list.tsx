import type { SubItem } from "~/common/fs/types";
import SubItemComponent from "./sub-item";

export default function SubItemsList({items}: {items: SubItem[]}) {
    items.sort((a: SubItem, b: SubItem) => {
        return ('' + a.name).localeCompare(b.name);
    });

    const buildListItem = (item: SubItem) => (
        <li key={item.path}>
            <SubItemComponent item={item} />
        </li>
    )

    return (
        <>
            <h3>Directory contents:</h3>
            <ul>
                {items.length === 0 && <p>No items</p>}
                {items.map((item) => buildListItem(item))}
            </ul>
        </>
    )
}