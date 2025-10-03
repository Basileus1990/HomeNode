//import type { Items } from "../fs/types";
import type { Item } from "../fs/types";

export default function DirectoryRecordListItem({rec, children}: {rec: Item, children?: React.ReactNode}) {
    return (
        <li key={rec.path + ":" + rec.name + "#" + rec.kind}>
            <strong>{rec.name} dir</strong>
            <br/>
            Size: {rec.size} bytes
            <br />
            <i>ID: {rec.path}</i>
            <br />
            {/* Date Shared: {new Date(rec.dateShared).toLocaleString()} */}
            <br />
            {children}
        </li>
    );
}