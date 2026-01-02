import { buildCollection, buildProperty } from "@firecms/core";

export const familiesCollection = buildCollection({
    id: "family_records",
    name: "Family Members",
    group: "User Management",
    path: "users",
    icon: "FamilyRestroom",
    description: "Manage family member profiles",
    initialFilter: {
        role: ["==", "family"]
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
                family: "Family Member"
            },
            defaultValue: "family",
            validation: { required: true },
            disabled: true
        }),
        email: buildProperty({
            name: "Email",
            dataType: "string"
        }),
        linkedSeniors: buildProperty({
            name: "Linked Seniors",
            dataType: "array",
            of: {
                dataType: "string",
                previewAsTag: true
            },
            description: "IDs of seniors linked to this family member"
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
