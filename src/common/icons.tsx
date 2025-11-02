import {
    IconTextPlus,
    IconTextCaption,
    IconFileText,
    IconAlignLeft,
    IconAlignCenter,
    IconAlignRight,
    IconPhoto,
    IconPhotoPlus,
    IconPlus,
    IconQuestionMark,
    IconX,
    IconAdjustmentsHorizontal,
    IconAlignJustified,
    IconTextIncrease,
    IconTextDecrease,
    IconArrowsDiagonal,
    IconArrowsDiagonalMinimize2,
    IconLayoutAlignMiddle,
    IconRotate2,
    IconRotateClockwise,
    IconRotateClockwise2,
    IconFlipVertical,
    IconFlipHorizontal,
    IconArrowBarUp,
    IconArrowBarDown,
    IconPrinter,
    IconSettings,
    IconMinus,
    IconClipboardPlus,
    IconGridDots,
    IconBrush,
    IconCircles,
    IconGrain,
} from "@tabler/icons-react";
import { INL_ICON_COLOR, INL_ICON_SIZE } from "./constants.ts";

export const Icons = {
    IconTextPlus,
    IconTextCaption,
    IconFileText,
    IconAlignLeft,
    IconAlignCenter,
    IconAlignRight,
    IconAlignJustified,
    IconPhoto,
    IconPhotoPlus,
    IconPlus,
    IconQuestionMark,
    IconAdjustmentsHorizontal,
    IconTextIncrease,
    IconTextDecrease,
    IconArrowsDiagonal,
    IconArrowsDiagonalMinimize2,
    IconLayoutAlignMiddle,
    IconRotate2,
    IconRotateClockwise,
    IconRotateClockwise2,
    IconFlipHorizontal,
    IconFlipVertical,
    IconArrowBarUp,
    IconArrowBarDown,
    IconX,
    IconPrinter,
    IconSettings,
    IconMinus,
    IconClipboardPlus,
    IconGridDots,
    IconBrush,
    IconCircles,
    IconGrain,
};

for (const key in Icons) {
    const icon = Icons[key as keyof typeof Icons];
    Icons[key as keyof typeof Icons] = (
        props: { [key: string]: string | number },
    ) => {
        props.size = props.size || INL_ICON_SIZE;
        props.color = props.color || INL_ICON_COLOR;
        return icon(props);
    };
}

export function icon(label: keyof typeof Icons) {
    const Icon = Icons[label];
    return <Icon size={INL_ICON_SIZE} color="currentColor" />;
}
