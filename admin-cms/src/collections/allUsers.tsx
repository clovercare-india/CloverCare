import { buildCollection, buildProperty } from "@firecms/core";

export const allUsersCollection = buildCollection({
    id: "all_user_records",
    name: "All Users",
    group: "User Management",
    path: "users",
    icon: "People",
    description: "View all users in the system",
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
                matches: /^\+91\d{10}$/,
                matchesMessage: "Please enter a valid Indian mobile number (e.g., +919876543210)"
            }
        }),
        role: buildProperty({
            name: "Role",
            dataType: "string",
            enumValues: {
                senior: "Senior",
                family: "Family Member",
                caremanager: "Care Manager",
                admin: "Admin"
            }
        }),
        email: buildProperty({
            name: "Email",
            dataType: "string"
        }),
        status: buildProperty({
            name: "Status",
            dataType: "string",
            enumValues: {
                active: "Active",
                inactive: "Inactive"
            }
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date"
        })
    }
});
