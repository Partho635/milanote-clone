"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

export const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea(props, fwd) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(fwd, () => ref.current!);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }, [props.value]);
  return <textarea rows={1} {...props} ref={ref} />;
});
