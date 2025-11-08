import type React from "react";
import { Button, Clipboard, Text, For } from "@chakra-ui/react";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "~/common/ui/chakra/components/menu";

import ItemQRCode from "./item-qr-code";


export type ItemMenuProps = {
    shareLink: string
    items: { value: string, children: React.ReactNode }[]
}

export default function ItemMenu(props: ItemMenuProps) {
    const { shareLink, items } = props;

    return (
        <MenuRoot>
            <MenuTrigger asChild>
                <Button size="md" variant="solid">
                    Menu
                </Button>
            </MenuTrigger>

            <MenuContent>
                <For
                    each={items}
                >
                    {(item, index) => (
                        <MenuItem value={item.value} key={index}>
                            {item.children}
                        </MenuItem>
                    )}
                </For>

                <MenuItem value="get-link" >
                    <Clipboard.Root value={shareLink} onClick={e => e.stopPropagation()}>
                        <Clipboard.Trigger asChild>
                            <Button variant="plain" size="sm">
                                <Clipboard.Indicator />
                                <Text>Copy URL</Text>
                            </Button>
                        </Clipboard.Trigger>
                    </Clipboard.Root>
                </MenuItem>

                <MenuItem value="get-qr-code">
                    <ItemQRCode shareLink={shareLink} />
                </MenuItem>

            </MenuContent>


        </MenuRoot>
    );
}