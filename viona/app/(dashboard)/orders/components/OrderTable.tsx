import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import {
  Pencil,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  User,
  Calendar,
  DollarSign,
  Eye,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import type { Order } from "../../api/orders/route";
import { is } from "date-fns/locale";

type SortKey = "id" | "orderDate" | "totalAmount" | "status";

interface OrderTableProps {
  orders: Order[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEdit?: (order: Order) => void;
  onDelete?: (id: string) => void;
  sortBy: SortKey;
  sortOrder: "asc" | "desc";
  onSort: (field: SortKey, order: "asc" | "desc") => void;
  isEmployee:boolean;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function OrderTable({
  orders,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
  isEmployee,
}: OrderTableProps) {
  const canSelect = Boolean(onDelete);

  const allSelected = orders.length > 0 && selectedIds.size === orders.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < orders.length;

  const handleSelectAll = (checked: boolean) => {
    if (!canSelect) return;
    onSelectionChange(
      checked ? new Set(orders.map(o => o.id)) : new Set()
    );
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!canSelect) return;
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    onSelectionChange(next);
  };

  const handleSort = (field: SortKey) => {
    const next =
      sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    onSort(field, next);
  };

  const sortIcon = (field: SortKey) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>

                {/* ✅ Checkbox header ONLY if allowed */}
                {canSelect && (
                  <TableHead className="w-12">
                    { !isEmployee &&(<Checkbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                          ? "indeterminate"
                          : false
                      }
                      onCheckedChange={handleSelectAll}
                    />)}
                  </TableHead>
                )}

                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("id")}>
                    Order ID {sortIcon("id")}
                  </Button>
                </TableHead>

                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("orderDate")}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Date {sortIcon("orderDate")}
                  </Button>
                </TableHead>

                <TableHead>
                  <User className="h-4 w-4 mr-1 inline" /> Customer
                </TableHead>

                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                  >
                    Status {sortIcon("status")}
                  </Button>
                </TableHead>

                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("totalAmount")}
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Total {sortIcon("totalAmount")}
                  </Button>
                </TableHead>

                <TableHead>
                  <Package className="h-4 w-4 mr-1 inline" /> Items
                </TableHead>

                <TableHead>Placed By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {orders.map(order => {
                const isSelected = selectedIds.has(order.id);

                return (
                  <TableRow key={order.id}>

                    {/* ✅ Checkbox cell ONLY if allowed */}
                    {canSelect && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={c =>
                            handleSelectOne(order.id, c as boolean)
                          }
                        />
                      </TableCell>
                    )}

                    <TableCell className="font-mono">
                      #{order.id}
                    </TableCell>

                    <TableCell>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{order.customer.name}</div>
                        {order.customer.email && (
                          <div className="text-xs text-muted-foreground flex gap-1">
                            <Mail className="h-3 w-3" />
                            {order.customer.email}
                          </div>
                        )}
                        {order.customer.phone && (
                          <div className="text-xs text-muted-foreground flex gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      ${order.totalAmount.toFixed(2)}
                    </TableCell>

                    <TableCell>
                      {order.orderItems.length}
                    </TableCell>

                    <TableCell>
                      {order.placedBy.email}
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-1">

                        <Link href={`/orders/${order.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>

                        {(onEdit || onDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              {onEdit && (
                                <DropdownMenuItem
                                  onClick={() => onEdit(order)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}

                              {onDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onDelete(order.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {orders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No orders found
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}
