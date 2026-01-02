import { buildCollection, buildProperty } from "@firecms/core";

export const remindersCollection = buildCollection({
    id: "reminder_records",
    name: "Reminders",
    group: "Care Management",
    path: "reminders",
    icon: "CalendarMonth",
    description: "Scheduled reminders for seniors",
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
        reminderType: buildProperty({
            name: "Type",
            dataType: "string",
            enumValues: {
                medication: "Medication",
                appointment: "Appointment",
                hydration: "Hydration",
                exercise: "Exercise",
                other: "Other"
            }
        }),
        scheduledTime: buildProperty({
            name: "Scheduled Time",
            dataType: "date",
            validation: { required: true }
        }),
        status: buildProperty({
            name: "Status",
            dataType: "string",
            enumValues: {
                pending: "Pending",
                completed: "Completed",
                missed: "Missed",
                deleted: "Deleted"
            },
            defaultValue: "pending"
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
