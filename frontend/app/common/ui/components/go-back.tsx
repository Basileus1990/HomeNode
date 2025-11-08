import { useNavigate } from "react-router";
import { IconButton} from "@chakra-ui/react";
import { Tooltip } from "~/common/ui/chakra/components/tooltip";
import { FiArrowLeft} from "react-icons/fi";

export default function GoBackButton() {
    const navigate = useNavigate();

    return (
        <IconButton onClick={() => navigate(-1)}>
            <Tooltip content="Go back">
                <FiArrowLeft />
            </Tooltip>
        </IconButton>
    );
}