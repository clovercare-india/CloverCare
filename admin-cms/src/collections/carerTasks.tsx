import { buildCollection, buildProperty } from "@firecms/core";

export const carerTasksCollection = buildCollection({
    id: "carer_task_records",
    name: "Carer Tasks",
    group: "Care Management",
    path: "carerTasks",
    icon: "Assignment",
    description: "Tasks assigned to seniors or carers",
    permissions: {
        edit: true,
        create: true,
        delete: true
    },
    properties: {
        userId: buildProperty({
            name: "User ID (Senior)",
            dataType: "string",
            validation: { required: true }
        }),
        taskType: buildProperty({
            name: "Task Type",
            dataType: "string",
            enumValues: {
                medication: "Medication",
                checkin: "Check-in",
                exercise: "Exercise",
                social: "Social Activity",
                other: "Other"
            }
        }),
        description: buildProperty({
            name: "Description",
            dataType: "string",
            multiline: true
        }),
        scheduledDate: buildProperty({
            name: "Scheduled Date",
            dataType: "date"
        }),
        status: buildProperty({
            name: "Status",
            dataType: "string",
            enumValues: {
                pending: "Pending",
                completed: "Completed",
                missed: "Missed"
            },
            defaultValue: "pending"
        }),
        completedAt: buildProperty({
            name: "Completed At",
            dataType: "date"
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
