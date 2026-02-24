export default function DashboardPage() {
    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Dashboard Overview</h2>
            <p className="text-gray-600">
                Welcome to the Nala's Admin Dashboard. Select an option from the sidebar to manage orders, inventory, or users.
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Placeholder Stats */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-700">Total Orders</h3>
                    <p className="text-3xl font-bold text-blue-900 mt-2">0</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <h3 className="text-lg font-semibold text-green-700">Revenue</h3>
                    <p className="text-3xl font-bold text-green-900 mt-2">$0.00</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h3 className="text-lg font-semibold text-purple-700">Pending Actions</h3>
                    <p className="text-3xl font-bold text-purple-900 mt-2">0</p>
                </div>
            </div>
        </div>
    );
}
