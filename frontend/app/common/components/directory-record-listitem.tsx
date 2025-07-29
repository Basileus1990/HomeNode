import type { Items } from "../fs/types";

export default function DirectoryRecordListItem({rec, children}: {rec: Items.DirectoryRecordItem, children?: React.ReactNode}) {
    return (
        <li key={rec.recordName}>
            <strong>{rec.contentName}</strong>
            <br />
            <i>ID: {rec.recordName}</i>
            <br />
            Date Shared: {new Date(rec.dateShared).toLocaleString()}
            <br />
            {children}
        </li>
    );
}