"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { Clock, Info } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
export type ScheduledTriggerFormValues = {
    cronExpression: string;
};

type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: ScheduledTriggerFormValues) => void;
    defaultValues?: Partial<ScheduledTriggerFormValues>;
}

// ── Helpers ──────────────────────────────────────────────────────────
const DAYS = [
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
    { value: "0", label: "Sunday" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

const MINUTE_INTERVALS = [
    { value: "1", label: "Every minute" },
    { value: "5", label: "Every 5 minutes" },
    { value: "10", label: "Every 10 minutes" },
    { value: "15", label: "Every 15 minutes" },
    { value: "30", label: "Every 30 minutes" },
];

const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}${ordinalSuffix(i + 1)}`,
}));

function ordinalSuffix(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

/** Build a cron expression from the friendly picker state. */
function buildCron(freq: Frequency, mins: string, hour: string, dayOfWeek: string, dayOfMonth: string): string {
    switch (freq) {
        case "minutes":
            return mins === "1" ? "* * * * *" : `*/${mins} * * * *`;
        case "hourly":
            return `0 * * * *`;
        case "daily":
            return `0 ${hour} * * *`;
        case "weekly":
            return `0 ${hour} * * ${dayOfWeek}`;
        case "monthly":
            return `0 ${hour} ${dayOfMonth} * *`;
    }
}

/** Describe the schedule in plain English. */
function describeSchedule(freq: Frequency, mins: string, hour: string, dayOfWeek: string, dayOfMonth: string): string {
    const hourLabel = HOURS.find((h) => h.value === hour)?.label ?? `${hour}:00`;
    switch (freq) {
        case "minutes":
            return mins === "1" ? "Runs every minute" : `Runs every ${mins} minutes`;
        case "hourly":
            return "Runs at the start of every hour";
        case "daily":
            return `Runs daily at ${hourLabel}`;
        case "weekly":
            return `Runs every ${DAYS.find((d) => d.value === dayOfWeek)?.label} at ${hourLabel}`;
        case "monthly":
            return `Runs on the ${dayOfMonth}${ordinalSuffix(Number(dayOfMonth))} of each month at ${hourLabel}`;
    }
}

/** Attempt to parse a cron expression back into picker state. */
function parseCron(cron: string): { freq: Frequency; mins: string; hour: string; dayOfWeek: string; dayOfMonth: string } {
    const defaults = { freq: "daily" as Frequency, mins: "5", hour: "9", dayOfWeek: "1", dayOfMonth: "1" };
    if (!cron) return defaults;

    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return defaults;

    const [min, hr, dom, , dow] = parts;

    // Every minute
    if (min === "*" && hr === "*") {
        return { ...defaults, freq: "minutes", mins: "1" };
    }
    // Every N minutes
    if (min.startsWith("*/") && hr === "*") {
        return { ...defaults, freq: "minutes", mins: min.slice(2) };
    }
    // Hourly
    if (min === "0" && hr === "*") {
        return { ...defaults, freq: "hourly" };
    }
    // Weekly
    if (dow !== "*" && dom === "*") {
        return { ...defaults, freq: "weekly", hour: hr, dayOfWeek: dow };
    }
    // Monthly
    if (dom !== "*") {
        return { ...defaults, freq: "monthly", hour: hr, dayOfMonth: dom };
    }
    // Daily
    return { ...defaults, freq: "daily", hour: hr };
}

// ── Component ────────────────────────────────────────────────────────
export const ScheduledTriggerDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
    const parsed = useMemo(() => parseCron(defaultValues.cronExpression || ""), [defaultValues.cronExpression]);

    const [freq, setFreq] = useState<Frequency>(parsed.freq);
    const [mins, setMins] = useState(parsed.mins);
    const [hour, setHour] = useState(parsed.hour);
    const [dayOfWeek, setDayOfWeek] = useState(parsed.dayOfWeek);
    const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            const p = parseCron(defaultValues.cronExpression || "");
            setFreq(p.freq);
            setMins(p.mins);
            setHour(p.hour);
            setDayOfWeek(p.dayOfWeek);
            setDayOfMonth(p.dayOfMonth);
        }
    }, [open, defaultValues.cronExpression]);

    const cronExpression = buildCron(freq, mins, hour, dayOfWeek, dayOfMonth);
    const summary = describeSchedule(freq, mins, hour, dayOfWeek, dayOfMonth);

    const handleSave = () => {
        onSubmit({ cronExpression });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="size-4" />
                        Schedule
                    </DialogTitle>
                    <DialogDescription>
                        Choose how often this workflow should run.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-1">
                    {/* Frequency */}
                    <div className="space-y-1.5">
                        <Label>Run this workflow</Label>
                        <Select value={freq} onValueChange={(v) => setFreq(v as Frequency)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="minutes">Every few minutes</SelectItem>
                                <SelectItem value="hourly">Every hour</SelectItem>
                                <SelectItem value="daily">Every day</SelectItem>
                                <SelectItem value="weekly">Every week</SelectItem>
                                <SelectItem value="monthly">Every month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Interval for minutes */}
                    {freq === "minutes" && (
                        <div className="space-y-1.5">
                            <Label>Interval</Label>
                            <Select value={mins} onValueChange={setMins}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MINUTE_INTERVALS.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Day of week for weekly */}
                    {freq === "weekly" && (
                        <div className="space-y-1.5">
                            <Label>Day</Label>
                            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Day of month for monthly */}
                    {freq === "monthly" && (
                        <div className="space-y-1.5">
                            <Label>Day of month</Label>
                            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTH_DAYS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Time selector for daily / weekly / monthly */}
                    {(freq === "daily" || freq === "weekly" || freq === "monthly") && (
                        <div className="space-y-1.5">
                            <Label>At</Label>
                            <Select value={hour} onValueChange={setHour}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {HOURS.map((h) => (
                                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="rounded-lg bg-muted px-3 py-2.5 flex items-start gap-2 text-sm">
                        <Info className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{summary}</span>
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-1">
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
