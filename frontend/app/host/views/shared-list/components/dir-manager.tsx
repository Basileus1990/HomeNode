import { Link, useFetcher } from "react-router";

import type { Item } from "~/common/fs/types";
import SubItemsList from "./sub-items-list";


export default function SharedDirectoryManger({item}: {item: Item}) {
    const fetcher = useFetcher();    
    
    const updatePermissionsFetcher = () => (
        <div
            style={{ border: '2px solid blue' }}
        >
            <fetcher.Form method="post">
                <label htmlFor="allowAddDir">Allow adding directories</label>
                <input type="checkbox" name="allowAddDir" defaultChecked={item.perms?.AllowAddDir} />
                <br/>
                <label htmlFor="allowAddFile">Allow adding files</label>
                <input type="checkbox" name="allowAddFile" defaultChecked={item.perms?.AllowAddFile} />
                <br/>
                <label htmlFor="allowDeleteDir">Allow deleting directories</label>
                <input type="checkbox" name="allowDeleteDir" defaultChecked={item.perms?.AllowDeleteDir} />
                <br/>
                <label htmlFor="allowDeleteFile">Allow deleting files</label>
                <input type="checkbox" name="allowDeleteFile" defaultChecked={item.perms?.AllowDeleteFile} />
                <br/>
                <input type="hidden" name="itemPath" value={item.path} />
                <button type="submit">Update permissions</button>
            </fetcher.Form>
        </div>
    );

    const addToDirLink = () => (
        <Link to={`/host/share/${item.path}`}>Add</Link>
    )

    const buildContents = () => {
        if (item.contents && item.contents.length > 0) {
            return  <SubItemsList items={item.contents}/>;
        } else {
            return <p>Empty directory</p>;
        }
    }

    return (
        <div>
            {addToDirLink()}
            <br/>
            {updatePermissionsFetcher()}
            <br/>
            {buildContents()}
        </div>
    )
}