import { Button, VStack, QrCode, Center, Text } from "@chakra-ui/react";
import { DialogRoot, DialogContent, DialogTrigger, DialogCloseTrigger } from "~/common/ui/chakra/components/dialog";


export default function ItemQRCode({ shareLink }: {shareLink: string}) {
    return (
        <VStack>
            <DialogRoot>
                <DialogTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="plain">
                        QR Code
                    </Button>
                </DialogTrigger>

                <DialogContent w="sm">
                    <DialogCloseTrigger />

                    <VStack p="6">
                        <Text fontSize="1.25rem">Your QR code</Text>
                        <QrCode.Root value={shareLink}>
                            <QrCode.Frame>
                                <QrCode.Pattern />
                            </QrCode.Frame>
                        </QrCode.Root>
                    </VStack>
                </DialogContent>
            </DialogRoot>
        </VStack>
    );
}
