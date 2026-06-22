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
        <div className="min-h-screen bg-[#FDFDFF] relative overflow-hidden font-sans">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-kasneb-green/5 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />

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

            <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.history.back()}
                            className="text-slate-400 hover:text-[#004E98] p-0 h-auto hover:bg-transparent group transition-all"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
                            <span className="font-bold text-xs uppercase tracking-widest">Return to Dashboard</span>
                        </Button>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none pt-2">
                            Account <span className="text-[#004E98]">Settings</span>
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Personal Info & Security */}
                    <div className="lg:col-span-8 space-y-10">
                        {/* Personal Details */}
                        <Card className="border-none claymorphism-card rounded-[3rem] overflow-hidden">
                            <CardHeader className="pt-10 px-10 pb-2">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-blue-50 claymorphism-inner-shadow rounded-2xl flex items-center justify-center">
                                        <div className="p-3 bg-white rounded-xl shadow-sm">
                                            <User className="h-6 w-6 text-[#004E98]" />
                                        </div>
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl font-black tracking-tight text-slate-900">Personal Information</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium tracking-tight">Update your public profile and contact details.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-10">
                                <form onSubmit={handleUpdateProfile} className="space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <Label htmlFor="firstName" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">First Name</Label>
                                            <Input
                                                id="firstName"
                                                value={profileData.firstName}
                                                onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                                                className="h-14 bg-white/50 border-white/50 claymorphism-inner-shadow px-6 rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="lastName" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                value={profileData.lastName}
                                                onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                                                className="h-14 bg-white/50 border-white/50 claymorphism-inner-shadow px-6 rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-5 top-5 h-4 w-4 text-slate-400" />
                                            <Input 
                                                id="email" 
                                                value={user.email} 
                                                disabled 
                                                className="h-14 pl-12 bg-slate-50/50 border-slate-100/50 cursor-not-allowed text-slate-400 font-bold rounded-2xl" 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="phone" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</Label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-5 top-5 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="phone"
                                                placeholder="+254 7XX XXX XXX"
                                                value={profileData.phoneNumber}
                                                onChange={e => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                                                className="h-14 pl-12 bg-white/50 border-white/50 claymorphism-inner-shadow rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button 
                                            type="submit" 
                                            disabled={saving} 
                                            className="h-14 bg-[#004E98] hover:bg-[#003B73] px-10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#004E98]/20 hover:scale-[1.02] transition-all"
                                        >
                                            {saving ? "Processing..." : "Save Changes"}
                                            {!saving && <Save className="ml-3 h-4 w-4" />}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Password Change */}
                        <Card className="border-none claymorphism-card rounded-[3rem] overflow-hidden">
                            <CardHeader className="pt-10 px-10 pb-2">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-amber-50 claymorphism-inner-shadow rounded-2xl flex items-center justify-center">
                                        <div className="p-3 bg-white rounded-xl shadow-sm">
                                            <Lock className="h-6 w-6 text-amber-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl font-black tracking-tight text-slate-900">Security & Password</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium tracking-tight">Keep your workspace credentials secure.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-10">
                                <form className="space-y-8">
                                    <div className="space-y-3">
                                        <Label htmlFor="currentPass" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Current Password</Label>
                                        <Input 
                                            id="currentPass" 
                                            type="password" 
                                            className="h-14 bg-white/50 border-white/50 claymorphism-inner-shadow px-6 rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <Label htmlFor="newPass" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">New Password</Label>
                                            <Input 
                                                id="newPass" 
                                                type="password" 
                                                className="h-14 bg-white/50 border-white/50 claymorphism-inner-shadow px-6 rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]" 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="confirmPass" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Confirm New Password</Label>
                                            <Input 
                                                id="confirmPass" 
                                                type="password" 
                                                className="h-14 bg-white/50 border-white/50 claymorphism-inner-shadow px-6 rounded-2xl text-slate-900 font-bold focus:ring-[#004E98]/20 transition-all border-2 focus:border-[#004E98]" 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button 
                                            variant="outline" 
                                            className="h-14 border-2 border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest px-10 rounded-2xl hover:bg-slate-50 transition-all"
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
                        <Card className="border-none claymorphism-card rounded-[3rem] overflow-hidden sticky top-8">
                            <CardHeader className="pt-8 px-8 pb-2">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-emerald-50 claymorphism-inner-shadow rounded-2xl flex items-center justify-center">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <Bell className="h-5 w-5 text-emerald-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-black tracking-tight text-slate-900">Notifications</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium tracking-tight">Alert preferences.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                {/* Global Channels */}
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3">Delivery Channels</h4>
                                    <div className="flex items-center justify-between p-4 bg-white/40 rounded-3xl claymorphism-inner-shadow border-white/50 border">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-xl shadow-sm">
                                                <Mail className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800 tracking-tight leading-none">Email</p>
                                                <p className="text-[10px] text-slate-500 font-medium pt-1">Weekly digests</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={preferences?.emailNotifications}
                                            onCheckedChange={(checked: boolean) => handleUpdatePreferences({ emailNotifications: checked })}
                                            className="data-[state=checked]:bg-[#004E98]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white/40 rounded-3xl claymorphism-inner-shadow border-white/50 border">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-xl shadow-sm">
                                                <Bell className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800 tracking-tight leading-none">In-App</p>
                                                <p className="text-[10px] text-slate-500 font-medium pt-1">Real-time alerts</p>
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
                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-orange-500/80 uppercase tracking-[0.2em] border-b border-orange-100 pb-3 flex items-center gap-2">
                                            <Briefcase className="h-3 w-3" /> Case Management
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-700 tracking-tight leading-none">Assignments</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">New cases</p>
                                                </div>
                                                <Switch
                                                    checked={preferences?.notifyOnAssignment}
                                                    onCheckedChange={(checked: boolean) => handleUpdatePreferences({ notifyOnAssignment: checked })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between px-1">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-700 tracking-tight leading-none">SLA Warnings</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Approaching deadlines</p>
                                                </div>
                                                <Switch
                                                    checked={preferences?.notifyOnSlaWarning}
                                                    onCheckedChange={(checked: boolean) => handleUpdatePreferences({ notifyOnSlaWarning: checked })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between px-1">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-700 tracking-tight leading-none">Comments</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Mentions & replies</p>
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
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.2em] border-b border-emerald-100 pb-3 flex items-center gap-2">
                                            <Users className="h-3 w-3" /> Stakeholders
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-bold italic text-center py-2 bg-slate-50/50 rounded-xl">Advanced options coming soon.</p>
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
