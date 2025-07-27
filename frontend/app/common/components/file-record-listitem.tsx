import type { FileRecordInfo } from "../../host/fs/types";

export default function FileRecordListItem({rec, children}: {rec: FileRecordInfo, children?: React.ReactNode}) {
    return (
        <li key={rec.recordName}>
            <strong>{rec.contentName}</strong>  ({rec.size}) bytes
            <br />
            <i>ID: {rec.recordName}</i>
            <br />
            Last Modified: {new Date(rec.lastModified).toLocaleString()}
            <br />
            Date Shared: {new Date(rec.dateShared).toLocaleString()}
            <br />
            {children}
        </li>
    );
}