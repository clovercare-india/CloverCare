import { buildCollection, buildProperty } from "@firecms/core";

export const careManagersCollection = buildCollection({
    id: "care_manager_records",
    name: "Care Managers",
    group: "User Management",
    path: "users",
    icon: "MedicalServices",
    description: "Manage care manager profiles",
    initialFilter: {
        role: ["==", "caremanager"]
    },
    permissions: {
        edit: true,
        create: true,
        delete: true
    },
    properties: {
        name: buildProperty({
            name: "Name",
            dataType: "string"
        }),
        fullName: buildProperty({
            name: "Full Name",
            dataType: "string"
        }),
        phone: buildProperty({
            name: "Phone Number",
            dataType: "string",
            validation: {
                required: true,
                matches: /^\+91\d{10}$/,
                matchesMessage: "Please enter a valid Indian mobile number (e.g., +919876543210)"
            }
        }),
        role: buildProperty({
            name: "Role",
            dataType: "string",
            enumValues: {
                caremanager: "Care Manager"
            },
            defaultValue: "caremanager",
            validation: { required: true },
            disabled: true
        }),
        email: buildProperty({
            name: "Email",
            dataType: "string"
        }),
        assignedSeniorIds: buildProperty({
            name: "Assigned Seniors",
            dataType: "array",
            of: {
                dataType: "string",
                previewAsTag: true
            },
            description: "IDs of seniors assigned to this care manager"
        }),
        status: buildProperty({
            name: "Account Status",
            dataType: "string",
            enumValues: {
                active: "Active",
                inactive: "Inactive"
            },
            defaultValue: "active"
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
