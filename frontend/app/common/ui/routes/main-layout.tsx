import { Outlet } from "react-router";
import { Center, Box } from "@chakra-ui/react";

import Navbar from "~/common/ui/components/navbar";


export default function MainLayout() {
    return (
        <Box>
            <Navbar />

            <Center>
                <Box w={{ base: "sm", md: "lg", lg: "50vw" }}>
                    <Outlet/>
                </Box>
            </Center>
        </Box>
    )
}