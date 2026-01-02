import { buildCollection, buildProperty } from "@firecms/core";

export const routinesCollection = buildCollection({
    id: "routine_records",
    name: "Routines",
    group: "Care Management",
    path: "routines",
    icon: "Schedule",
    description: "Daily routines for seniors",
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
        title: buildProperty({
            name: "Title",
            dataType: "string",
            validation: { required: true }
        }),
        description: buildProperty({
            name: "Description",
            dataType: "string",
            multiline: true
        }),
        frequency: buildProperty({
            name: "Frequency",
            dataType: "string",
            enumValues: {
                daily: "Daily",
                weekly: "Weekly",
                monthly: "Monthly",
                once: "Once"
            }
        }),
        scheduledTime: buildProperty({
            name: "Scheduled Time",
            dataType: "date"
        }),
        isActive: buildProperty({
            name: "Is Active",
            dataType: "boolean",
            defaultValue: true
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
