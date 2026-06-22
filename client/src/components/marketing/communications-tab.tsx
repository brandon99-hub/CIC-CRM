import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Communication {
    id: string;
    type: string;
    channel: string;
    direction: string;
    subject?: string;
    toAddress?: string;
    status: string;
    createdAt: string;
}

interface CommunicationsTabProps {
    communications: Communication[];
    filter: string;
    onFilterChange: (value: string) => void;
}

export function CommunicationsTab({ communications, filter, onFilterChange }: CommunicationsTabProps) {
    return (
        <div className="space-y-6">

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead>Direction</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>To/From</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {communications.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No communications logged yet.</TableCell></TableRow>
                            ) : communications.map((comm) => (
                                <TableRow key={comm.id}>
                                    <TableCell><Badge variant="outline">{comm.type}</Badge></TableCell>
                                    <TableCell>
                                        <Badge className={comm.channel === "email" ? "bg-[#004E98]" : comm.channel === "sms" ? "bg-[#01a64e]" : comm.channel === "phone" ? "bg-[#D0AC01]" : "bg-[#e55f00]"}>
                                            {comm.channel}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {comm.direction === "inbound"
                                            ? <Badge variant="outline" className="border-[#01a64e] text-[#01a64e]">Inbound</Badge>
                                            : <Badge variant="outline" className="border-[#004E98] text-[#004E98]">Outbound</Badge>
                                        }
                                    </TableCell>
                                    <TableCell>{comm.subject || "—"}</TableCell>
                                    <TableCell className="text-sm">{comm.toAddress || "—"}</TableCell>
                                    <TableCell>
                                        <Badge className={comm.status === "delivered" ? "bg-[#01a64e]" : comm.status === "sent" ? "bg-[#004E98]" : comm.status === "read" ? "bg-[#D0AC01]" : "bg-gray-400"}>
                                            {comm.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{new Date(comm.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
