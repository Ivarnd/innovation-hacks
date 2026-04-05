"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import React from "react";

function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

function Input({ className, size = "default", nativeInput = false, ...props }) {
  const inputClassName = cn("autocomplete-input-inner", size === "sm" && "ac-sm", size === "lg" && "ac-lg");
  return (
    <span className={cn("autocomplete-input-wrap", className)}>
      {nativeInput ? (
        <input className={inputClassName} {...props} />
      ) : (
        <InputPrimitive className={inputClassName} {...props} />
      )}
    </span>
  );
}

function ScrollArea({ className, children, ...props }) {
  return (
    <ScrollAreaPrimitive.Root className={cn("ac-scroll-area", className)} {...props}>
      <ScrollAreaPrimitive.Viewport>{children}</ScrollAreaPrimitive.Viewport>
    </ScrollAreaPrimitive.Root>
  );
}

export const Autocomplete = AutocompletePrimitive.Root;

export function AutocompleteInput({ className, showTrigger = false, showClear = false, startAddon, size, triggerProps, clearProps, ...props }) {
  return (
    <AutocompletePrimitive.InputGroup className="ac-input-group">
      {startAddon && <div>{startAddon}</div>}
      <AutocompletePrimitive.Input
        className={className}
        render={<Input nativeInput size={size || "default"} />}
        {...props}
      />
      {showTrigger && (
        <AutocompletePrimitive.Trigger className="ac-trigger" {...triggerProps}>
          <ChevronsUpDownIcon size={14} />
        </AutocompletePrimitive.Trigger>
      )}
      {showClear && (
        <AutocompletePrimitive.Clear className="ac-clear" {...clearProps}>
          <XIcon size={14} />
        </AutocompletePrimitive.Clear>
      )}
    </AutocompletePrimitive.InputGroup>
  );
}

export function AutocompletePopup({ children, ...props }) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner {...props}>
        <AutocompletePrimitive.Popup className="ac-popup">
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  );
}

export function AutocompleteItem({ children, ...props }) {
  return (
    <AutocompletePrimitive.Item className="ac-item" {...props}>
      {children}
    </AutocompletePrimitive.Item>
  );
}

export function AutocompleteList(props) {
  return (
    <ScrollArea>
      <AutocompletePrimitive.List className="ac-list" {...props} />
    </ScrollArea>
  );
}

export function AutocompleteEmpty(props) {
  return <AutocompletePrimitive.Empty className="ac-empty" {...props} />;
}

export const useAutocompleteFilter = AutocompletePrimitive.useFilter;
