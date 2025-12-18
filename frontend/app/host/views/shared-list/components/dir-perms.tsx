import { useEffect } from "react";
import { useFetcher } from "react-router";
import { Box, Button, Heading, Text, VStack, Fieldset, CheckboxGroup } from "@chakra-ui/react";
import { DialogRoot, DialogContent, DialogTrigger, DialogCloseTrigger } from "~/common/ui/chakra/components/dialog";
import { toaster } from "~/common/ui/chakra/components/toaster";
import { Checkbox } from "~/common/ui/chakra/components/checkbox";

import type { Item } from "~/common/fs/types";


export default function DirPermissionsForm({ item }: {item: Item}) {
  const fetcher = useFetcher();

    useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
        const { ok, message } = fetcher.data;

        queueMicrotask(() => {
        toaster.create({
            title: ok ? "Permissions updated" : "Update failed",
            description: message ?? (ok ? "Your changes were saved." : "Something went wrong."),
            type: ok ? "success" : "error",
            meta: { closable: true, duration: 4000 },
        });
        });
    }
    }, [fetcher.state, fetcher.data]);

    const permissionForm = () => (
        <Box
            p="6"
        >
            <Heading size="md" mb="4">
                Update Permissions
            </Heading>

            <fetcher.Form method="post">
                <Fieldset.Root>
                    <CheckboxGroup>
                        <Fieldset.Content>
                            <Checkbox
                                name="allowAddDir"
                                defaultChecked={item.perms?.AllowAddDir}
                                onClick={e => e.stopPropagation()}
                            >
                                Allow adding directories
                            </Checkbox>

                            <Checkbox
                                name="allowAddFile"
                                defaultChecked={item.perms?.AllowAddFile}
                                onClick={e => e.stopPropagation()}
                            >
                                Allow adding files
                            </Checkbox>

                            <Checkbox
                                name="allowDeleteDir"
                                defaultChecked={item.perms?.AllowDeleteDir}
                                onClick={e => e.stopPropagation()}
                            >
                                Allow deleting directories
                            </Checkbox>

                            <Checkbox
                                name="allowDeleteFile"
                                defaultChecked={item.perms?.AllowDeleteFile}
                                onClick={e => e.stopPropagation()}
                            >
                                Allow deleting files
                            </Checkbox>

                            <input type="hidden" name="itemPath" value={item.path} />

                            <Button
                                type="submit"
                                variant="solid"
                                loading={fetcher.state !== "idle"}
                                loadingText="Updating..."
                                onClick={e => e.stopPropagation()}
                            >
                                Update Permissions
                            </Button>

                            {fetcher.data?.message && (
                                <Text color="fg.muted" fontSize="sm">
                                {fetcher.data.message}
                                </Text>
                            )}
                        </Fieldset.Content>
                    </CheckboxGroup>
                </Fieldset.Root>
            </fetcher.Form>
        </Box>
    );

    return (
        <VStack>
            <DialogRoot >
                <DialogTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="plain" size="sm">
                        Permissions
                    </Button>
                </DialogTrigger>

                <DialogContent>
                    <DialogCloseTrigger />

                    {permissionForm()}
                </DialogContent>
            </DialogRoot>
        </VStack>
    );
}
