import { GetServerSidePropsContext } from "next";
import { Button } from "@/components/ui/button";
import Combobox from "@/components/custom/combobox";
import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/router";

type GetJiraSitesProps = {
    sites: {
        site_id: string;
        site_name: string;
    }[];
} | {
    error: string;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { connection_code } = context.query;
    const api_url = `${process.env.NEXT_PUBLIC_JUNCTURE_SERVER_URL}/api/frontend/finalize-connection/jira/get-jira-sites`;
    
    try {
        const response = await axios.post(api_url, {
            connection_code,
        });

        const data = response.data;
        if ('error' in data) {
            return {
                props: {
                    error: data.error,
                },
            };
        }
        
        return {
            props: {
                sites: data.sites,
            },
        };
    } catch (error) {
        console.error(error);
        const responseJson = (error as any)?.response?.data;
        if (responseJson && typeof responseJson === 'object' && 'error' in responseJson) {
            return {
                props: {
                    error: responseJson.error,
                },
            };
        }

        return {
            props: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

export default function FinalizeJiraConnectionPage(props: GetJiraSitesProps) {
    const [value, setValue] = useState("");
    const router = useRouter();
    const connection_code = router.query.connection_code as string;

    async function onSubmit() {
        if (!value) {
            toast.error("Please select a Jira site.");
            return;
        };

        const api_url = `${process.env.NEXT_PUBLIC_JUNCTURE_SERVER_URL}/api/frontend/finalize-connection/jira/set-jira-site`;
        
        try {
            const response = await axios.post(api_url, {
                connection_code,
                site_id: value,
            });

            const data = response.data;
            if ('error' in data) {
                toast.error(data.error);
                return;
            }

            toast.success("Jira connection finalized successfully.");
            router.push("/");
            return;
        } catch (error) {
            console.error(error);
            const responseJson = (error as any)?.response?.data;
            if (responseJson && typeof responseJson === 'object' && 'error' in responseJson) {
                toast.error(responseJson.error);
                return;
            }

            toast.error("Failed to finalize Jira connection. Please try again later.");
            return;
        }
    }

    if ('error' in props) {
        return (
            <div className="flex flex-col gap-2 items-center h-dvh justify-center p-8">
                <h1 className="text-3xl font-semibold text-dark-gray-text mb-8">Failed to finalize Jira connection</h1>
                <h3 className="font-medium text-dark-gray-text">Please try again later.</h3>

                <p className="text-red-500">{props.error}</p>
            </div>
        )
    }


    return (
        <div className="flex flex-col gap-2 items-center h-dvh justify-center p-8">
            <h1 className="text-3xl font-semibold text-dark-gray-text mb-8">Finalize Your Jira Connection</h1>

            <h3 className="font-medium text-dark-gray-text">Choose which site you want to connect to:</h3>


            <Combobox
                items={props.sites.map(site => ({
                    value: site.site_id,
                    label: site.site_name,
                }))}
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