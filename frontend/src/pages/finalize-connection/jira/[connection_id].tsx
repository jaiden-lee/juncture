import { GetServerSidePropsContext } from "next";
import { Button } from "@/components/ui/button";
import Combobox from "@/components/custom/combobox";
import { useState } from "react";
import { toast } from "sonner";

export async function getServerSideProps(context: GetServerSidePropsContext) {
    return {
        props: {},
    };
}

export default function FinalizeJiraConnectionPage() {
    const [value, setValue] = useState("");

    function onSubmit() {
        if (!value) {
            toast.error("Please select a Jira site.");
            return;
        };

        
    }
    return (
        <div className="flex flex-col gap-2 items-center h-dvh justify-center p-8">
            <h1 className="text-3xl font-semibold text-dark-gray-text mb-8">Finalize Your Jira Connection</h1>

            <h3 className="font-medium text-dark-gray-text">Choose which site you want to connect to:</h3>


            <Combobox
                items={[
                    { value: "1", label: "Projectile" },
                    { value: "2", label: "Agiler" },
                    { value: "3", label: "Juncture" },
                ]}
                value={value}
                onValueChange={setValue}
                className="w-full max-w-84"
                buttonClassName="w-full justify-between py-6"
                placeholder="Select a Jira site..."
                searchPlaceholder="Search Jira sites..."
                emptyMessage="No Jira site found."
            />

        
            <Button className="w-full max-w-84 font-medium py-6 mt-2" onClick={onSubmit}>Finish and create connection!</Button>

        </div>
    );
}