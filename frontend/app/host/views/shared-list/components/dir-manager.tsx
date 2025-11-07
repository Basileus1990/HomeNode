import { Link as RouterLink, useFetcher } from "react-router";
import { For, VStack } from "@chakra-ui/react";
import { FiMenu, FiBox, FiTrash } from "react-icons/fi";

import type { Item } from "~/common/fs/types";
import SubItemsList from "./sub-items-list";
import SubItemComponent from "./sub-item";


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

    return (
        <>
            <RouterLink to={`/host/share/${item.path}`}>Add</RouterLink>
            <br/>
            {updatePermissionsFetcher()}
            <br/>
            <For
                each={item.contents}
                fallback={
                    <VStack textAlign="center" fontWeight="medium">
                        <FiBox />
                        Directory is empty
                    </VStack>
                }
            >
                {(item, index) => (
                    <SubItemComponent 
                        item={item}
                        perms={undefined}

                    />
                )
                }
            </For>
        </>
    )
}