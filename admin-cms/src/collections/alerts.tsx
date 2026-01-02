import { buildCollection, buildProperty } from "@firecms/core";

export const alertsCollection = buildCollection({
    id: "alert_records",
    name: "Alerts",
    group: "Monitoring",
    path: "alerts",
    icon: "NotificationsActive",
    description: "System alerts and panic buttons",
    permissions: {
        edit: true,
        create: true,
        delete: true
    },
    properties: {
        userId: buildProperty({
            name: "User ID",
            dataType: "string",
            validation: { required: true }
        }),
        seniorName: buildProperty({
            name: "Senior Name",
            dataType: "string"
        }),
        type: buildProperty({
            name: "Alert Type",
            dataType: "string",
            enumValues: {
                panic_button: "Panic Button",
                missed_checkin: "Missed Check-in",
                medication: "Medication",
                fall_detected: "Fall Detected",
                other: "Other"
            }
        }),
        reason: buildProperty({
            name: "Reason",
            dataType: "string"
        }),
        message: buildProperty({
            name: "Message",
            dataType: "string"
        }),
        severity: buildProperty({
            name: "Severity",
            dataType: "string",
            enumValues: {
                critical: "Critical",
                high: "High",
                medium: "Medium",
                low: "Low"
            }
        }),
        status: buildProperty({
            name: "Status",
            dataType: "string",
            enumValues: {
                active: "Active",
                resolved: "Resolved",
                investigating: "Investigating"
            },
            defaultValue: "active"
        }),
        assignedTo: buildProperty({
            name: "Assigned To (CM ID)",
            dataType: "string"
        }),
        adminResolutionNotes: buildProperty({
            name: "Resolution Notes",
            dataType: "string",
            multiline: true,
            description: "Notes explaining how the alert was resolved"
        }),
        triggeredAt: buildProperty({
            name: "Triggered At",
            dataType: "date"
        }),
        resolvedAt: buildProperty({
            name: "Resolved At",
            dataType: "date"
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
