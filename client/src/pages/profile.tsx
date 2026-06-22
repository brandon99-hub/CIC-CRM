import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api-client";
import { DashboardNavbar } from "@/components/shared/dashboard-navbar";
import { useNotifications } from "@/hooks/use-notifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "../components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
    User,
    Lock,
    Bell,
    Mail,
    Smartphone,
    Save,
    ArrowLeft,
    Shield,
    Briefcase,
    Users,
    TrendingUp,
    BarChart3
} from "lucide-react";

export default function ProfilePage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const [user, setUser] = useState<any>(null);
    const [preferences, setPreferences] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [profileData, setProfileData] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: ""
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await apiRequest("/api/profile");
                const data = await res.json();
                setUser(data.user);
                setPreferences(data.preferences);
                setProfileData({
                    firstName: data.user.firstName || "",
                    lastName: data.user.lastName || "",
                    phoneNumber: data.user.phoneNumber || ""
                });
            } catch (error) {
                console.error("Profile fetch error:", error);
                toast({
                    title: "Error",
                    description: "Failed to load profile data",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [setLocation, toast]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await apiRequest("/api/profile", {
                method: "PATCH",
                body: JSON.stringify(profileData)
            });
            if (!res.ok) throw new Error("Update failed");

            toast({
                title: "Success",
                description: "Profile updated successfully",
            });

            // Update local user data
            const updatedUser = { ...user, ...profileData };
            setUser(updatedUser);
            localStorage.setItem("marketingUser", JSON.stringify(updatedUser));
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update profile",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePreferences = async (updates: any) => {
        const newPrefs = { ...preferences, ...updates };
        setPreferences(newPrefs); // Optimistic update

        try {
            const res = await apiRequest("/api/profile/preferences", {
                method: "PATCH",
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error("Failed to update preferences");
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save preferences",
                variant: "destructive"
            });
            // Revert on error
            setPreferences(preferences);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#004E98] border-t-transparent" />
        </div>
    );

    const hasPermission = (module: string) => {
        const access = user?.dashboardAccess || [];
        return access.includes(module);
    };

    return (
        <div className="min-h-screen bg-slate-50 relative font-sans">
            <DashboardNavbar
                activeTab="profile"
                tabLabel="My Profile"
                tabIcon={User}
                user={user}
                onLogout={() => {
                    localStorage.removeItem("marketingUser");
                    window.location.href = "/marketing/login";
                }}
                onToggleMobileMenu={() => { }}
                isMobileMenuOpen={false}
                notifications={notifications}
                onNotificationRead={markAsRead}
                onReadAllNotifications={markAllAsRead}
                hubVisible={user?.dashboardAccess?.length > 1}
            />

            <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.history.back()}
                            className="text-slate-500 hover:text-[#004E98] p-0 h-auto hover:bg-transparent group transition-all"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
                            <span className="font-semibold text-sm">Return to Dashboard</span>
                        </Button>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Account Settings
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Personal Info & Security */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Personal Details */}
                        <Card className="shadow-sm border border-slate-200 rounded-xl bg-white overflow-hidden">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 rounded-lg text-blue-700">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold text-slate-900">Personal Information</CardTitle>
                                        <CardDescription className="text-sm text-slate-500">Update your public profile and contact details.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handleUpdateProfile} className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName" className="text-sm font-semibold text-slate-700">First Name</Label>
                                            <Input
                                                id="firstName"
                                                value={profileData.firstName}
                                                onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                                                className="h-10 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName" className="text-sm font-semibold text-slate-700">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                value={profileData.lastName}
                                                onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                                                className="h-10 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input 
                                                id="email" 
                                                value={user.email} 
                                                disabled 
                                                className="h-10 pl-10 bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500 rounded-md" 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">Phone Number</Label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="phone"
                                                placeholder="+254 7XX XXX XXX"
                                                value={profileData.phoneNumber}
                                                onChange={e => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                                                className="h-10 pl-10 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button 
                                            type="submit" 
                                            disabled={saving} 
                                            className="bg-[#004E98] hover:bg-[#003B73] px-6 h-10 rounded-md font-semibold text-white transition-all shadow-sm"
                                        >
                                            {saving ? "Processing..." : "Save Changes"}
                                            {!saving && <Save className="ml-2 h-4 w-4" />}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Password Change */}
                        <Card className="shadow-sm border border-slate-200 rounded-xl bg-white overflow-hidden">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-100 rounded-lg text-amber-700">
                                        <Lock className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold text-slate-900">Security & Password</CardTitle>
                                        <CardDescription className="text-sm text-slate-500">Keep your workspace credentials secure.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPass" className="text-sm font-semibold text-slate-700">Current Password</Label>
                                        <Input 
                                            id="currentPass" 
                                            type="password" 
                                            className="h-10 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="newPass" className="text-sm font-semibold text-slate-700">New Password</Label>
                                            <Input 
                                                id="newPass" 
                                                type="password" 
                                                className="h-10 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPass" className="text-sm font-semibold text-slate-700">Confirm New Password</Label>
                                            <Input 
                                                id="confirmPass" 
                                                type="password" 
                                                className="h-10 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]" 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button 
                                            variant="outline" 
                                            className="h-10 px-6 border border-slate-300 text-slate-700 font-semibold rounded-md hover:bg-slate-50 transition-all"
                                        >
                                            Update Password
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Preferences */}
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="shadow-sm border border-slate-200 rounded-xl bg-white overflow-hidden sticky top-8">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-100 rounded-lg text-emerald-700">
                                        <Bell className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold text-slate-900">Notifications</CardTitle>
                                        <CardDescription className="text-sm text-slate-500">Alert preferences.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                {/* Global Channels */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Delivery Channels</h4>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-4 w-4 text-slate-500" />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">Email</p>
                                                <p className="text-xs text-slate-500">Weekly digests</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={preferences?.emailNotifications}
                                            onCheckedChange={(checked: boolean) => handleUpdatePreferences({ emailNotifications: checked })}
                                            className="data-[state=checked]:bg-[#004E98]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <Bell className="h-4 w-4 text-slate-500" />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">In-App</p>
                                                <p className="text-xs text-slate-500">Real-time alerts</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={preferences?.inAppNotifications}
                                            onCheckedChange={(checked: boolean) => handleUpdatePreferences({ inAppNotifications: checked })}
                                            className="data-[state=checked]:bg-[#004E98]"
                                        />
                                    </div>
                                </div>

                                {/* Case Management - Only if has access */}
                                {hasPermission("cases") && (
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                                            <Briefcase className="h-3 w-3" /> Case Management
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">Assignments</p>
                                                    <p className="text-xs text-slate-500">New cases</p>
                                                </div>
                                                <Switch
                                                    checked={preferences?.notifyOnAssignment}
                                                    onCheckedChange={(checked: boolean) => handleUpdatePreferences({ notifyOnAssignment: checked })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">SLA Warnings</p>
                                                    <p className="text-xs text-slate-500">Approaching deadlines</p>
                                                </div>
                                                <Switch
                                                    checked={preferences?.notifyOnSlaWarning}
                                                    onCheckedChange={(checked: boolean) => handleUpdatePreferences({ notifyOnSlaWarning: checked })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">Comments</p>
                                                    <p className="text-xs text-slate-500">Mentions & replies</p>
                                                </div>
                                                <Switch
                                                    checked={preferences?.notifyOnComment}
                                                    onCheckedChange={(checked: boolean) => handleUpdatePreferences({ notifyOnComment: checked })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Other Modules Placeholder */}
                                {hasPermission("stakeholders") && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                                            <Users className="h-3 w-3" /> Stakeholders
                                        </h4>
                                        <p className="text-xs text-slate-400 italic bg-slate-50 rounded-md p-3">Advanced options coming soon.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
