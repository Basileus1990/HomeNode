//import type { Items } from "../fs/types";
import type { Item } from "../fs/types";

export default function FileRecordListItem({rec, children}: {rec: Item, children?: React.ReactNode}) {
    return (
        // <li key={rec.recordName}>
        //     <strong>{rec.contentName}</strong>  ({rec.size}) bytes
        //     <br />
        //     <i>ID: {rec.recordName}</i>
        //     <br />
        //     Last Modified: {new Date(rec.lastModified).toLocaleString()}
        //     <br />
        //     Date Shared: {new Date(rec.dateShared).toLocaleString()}
        //     <br />
        //     {children}
        // </li>
        <li key={rec.path + ":" + rec.name + "#" + rec.kind}>
            <strong>{rec.name} file</strong>
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