import React from "react";
import { Link } from "react-router-dom";
import { useNavigationController, useFireCMSContext } from "@firecms/core";
import {
    Card,
    CardContent,
    Typography,
    Grid,
    Box,
    Button
} from "@mui/material";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export function CMSWelcome() {

    const navigation = useNavigationController();

    // Get top-level collections
    const collections = navigation.collections ?? [];

    return (
        <Box p={4} sx={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

            <Box mb={4}>
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        variant="text"
                        sx={{ color: 'text.secondary', fontWeight: 'bold' }}
                    >
                        Back to Dashboard
                    </Button>
                </Link>
            </Box>

            <Box mb={6}>
                <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                    Database Collections
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Select a collection to manage records
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {collections.map((collection) => (
                    <Grid xs={12} sm={6} md={4} key={collection.id}>
                        <Link
                            to={`/c/${collection.id}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <Card
                                sx={{
                                    height: '100%',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4,
                                        cursor: 'pointer'
                                    },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <CardContent>
                                    <Box display="flex" alignItems="center" mb={2}>
                                        {/* You could render Icon here if available inside properties */}
                                        <Typography variant="h6" component="h2" fontWeight="bold">
                                            {collection.name}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {collection.description || "Manage records for " + collection.name}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        endIcon={<ArrowForwardIcon />}
                                        fullWidth
                                    >
                                        View Records
                                    </Button>
                                </CardContent>
                            </Card>
                        </Link>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
