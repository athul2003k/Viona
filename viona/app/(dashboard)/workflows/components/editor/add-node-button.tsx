"use client";

import { PlusIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { NodeSelector } from "../node-selector";
import { useState } from "react";


export const AddNodeButton = memo(() => {
    const [selectorOpen, setSelectorOpen] = useState(false);
    return(
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
        
        <Button
        variant="outline"
        size="icon"
        className="bg-background"
        >
            <PlusIcon/>
        </Button>
    </NodeSelector>
    )
});

AddNodeButton.displayName = "AddNodeButton";
