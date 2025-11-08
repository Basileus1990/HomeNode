import { Text, Icon, For, HStack, Box, Container } from "@chakra-ui/react";
import { FiFile, FiFolder, FiChevronRight } from "react-icons/fi";

export default function Path({path, kind}: {path: string, kind: "file" | "directory"}) {
    const steps = path.split("/");

    const buildPath = () => {
        if (steps.length > 1) {
            return (
                <For
                    each={steps.slice(0, -1)}
                >
                    {(step, index) => (
                        <HStack key={index} gap="0" hideBelow="md">
                            <Text>
                                {step}
                            </Text>
                            <Icon size="md">
                                <FiChevronRight />
                            </Icon>
                        </HStack>
                    )}
                </For>
            );
        }
    }

    return (
        <HStack
            alignItems="center"
            justifyContent="center"
        >
            <Icon size="md">
                {kind === "file" ? <FiFile /> : <FiFolder />}
            </Icon>

            {buildPath()}

            <Text fontWeight="bold">{steps.at(-1)}</Text>
        </HStack>
    )
}