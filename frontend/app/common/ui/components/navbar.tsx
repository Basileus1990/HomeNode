// Code adapated from: https://github.com/andemosa/chakra-navbar

import { Outlet, Link as RouterLink } from "react-router";
import { Box, Text, HStack, VStack, Link, Button, useDisclosure, Portal, IconButton, Flex } from "@chakra-ui/react";
import { 
    DrawerRoot,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerBody,
    DrawerBackdrop,
    DrawerCloseTrigger,
} from "~/common/ui/chakra/components/drawer";
import { ColorModeButton } from "~/common/ui/chakra/components/color-mode";
import { FiMenu } from "react-icons/fi";


/* ---------------- MENU LINKS ---------------- */
const links = [
  { name: "Home", href: "#home" },
  { name: "About", href: "#about" },
  { name: "Services", href: "#services" },
  { name: "Contact", href: "#contact" },
];

const MenuLinks = ({ isMobile = false }: { isMobile?: boolean }) => {
  const LinkComponent = isMobile ? VStack : HStack;

  return (
    <LinkComponent gap={isMobile ? 4 : 8} align="center">
        <Link asChild>
            <RouterLink to="/host/share">Share new file</RouterLink>
        </Link>

        <Link asChild>
            <RouterLink to="/host/shared">Your shared files</RouterLink>
        </Link>

        <ColorModeButton />
    </LinkComponent>
  );
};

/* ---------------- NAVBAR ---------------- */
const Navbar = () => {
  return (
    <Flex
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={{ base: 8, lg: 16 }}
      px={{ base: 6, lg: 12 }}
      py={3}
      maxW={{ base: "full", xl: "1440px" }}
      mx="auto"
    >
        <Box>
            <Text 
                fontSize="2xl" 
                fontWeight="bolder" 
                bgGradient="to-r"
                bgClip='text'
                gradientFrom="colorPalette.500" 
                gradientTo="colorPalette.200"
            >
                HomeNode
            </Text>
        </Box>

        <Box hideBelow="md">
          <MenuLinks />
        </Box>

        <Box hideFrom="md">
            <DrawerRoot size="lg" placement="top">
                <DrawerTrigger asChild>
                    <IconButton variant="outline">
                        <FiMenu />
                    </IconButton>
                </DrawerTrigger>
                    <DrawerBackdrop />

                    <DrawerContent>

                    <DrawerCloseTrigger />

                    <DrawerHeader>
                        <DrawerTitle>
                            <Box>
                                <Text fontSize="lg" fontWeight="bold" color="colorPalette.500">
                                    Logo
                                </Text>
                            </Box>
                        </DrawerTitle>
                    </DrawerHeader>

                    <DrawerBody>
                        <MenuLinks isMobile />
                    </DrawerBody>

                </DrawerContent>
            </DrawerRoot>
        </Box>
    </Flex>
  );
};

export default Navbar;