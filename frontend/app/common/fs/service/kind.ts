import { RecordKind } from "../types";
import { FILE_RECORD_PREFIX, DIR_RECORD_PREFIX } from "../objects/config";

export function checkKind(name: string): RecordKind | undefined {
    if (name.includes(FILE_RECORD_PREFIX))
        return RecordKind.file;
    else if (name.includes(DIR_RECORD_PREFIX))
        return RecordKind.directory;
    else
        return undefined;
}