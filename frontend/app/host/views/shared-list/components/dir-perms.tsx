import { Box, Button, Stack, Heading, Text, VStack, Fieldset, CheckboxGroup } from "@chakra-ui/react";
import { toaster, Toaster } from "~/components/ui/toaster";
import { DialogRoot, DialogContent, DialogTrigger, DialogCloseTrigger } from "~/components/ui/dialog";
import { CloseButton } from "~/components/ui/close-button";
import { Checkbox } from "~/components/ui/checkbox";
import { useFetcher } from "react-router";
import { useEffect } from "react";

import type { Item } from "~/common/fs/types";


export function DirPermissionsForm({ item }: {item: Item}) {
  const fetcher = useFetcher();

  // Run side effect when fetcher completes
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
                            >
                                Allow adding directories
                            </Checkbox>

                            <Checkbox
                                name="allowAddFile"
                                defaultChecked={item.perms?.AllowAddFile}
                            >
                                Allow adding files
                            </Checkbox>

                            <Checkbox
                                name="allowDeleteDir"
                                defaultChecked={item.perms?.AllowDeleteDir}
                            >
                                Allow deleting directories
                            </Checkbox>

                            <Checkbox
                                name="allowDeleteFile"
                                defaultChecked={item.perms?.AllowDeleteFile}
                            >
                                Allow deleting files
                            </Checkbox>

                            <input type="hidden" name="itemPath" value={item.path} />

                            <Button
                                type="submit"
                                variant="solid"
                                loading={fetcher.state !== "idle"}
                                loadingText="Updating..."
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
            <DialogRoot>
                <DialogTrigger asChild>
                    <Button variant="outline">Open Dialog</Button>
                </DialogTrigger>

                <DialogContent>
                    <DialogCloseTrigger />

                    {permissionForm()}
                </DialogContent>
            </DialogRoot>
        </VStack>
    );
}
