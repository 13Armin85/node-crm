import { tr, withLocalization } from 'i18n/runtime';
import Card from "components/card/Card";
import { SimpleGrid, Stat, StatLabel, StatNumber } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { getApi } from "services/api";
import ReportChart from "./components/reportChart";
import CommonCheckTable from "components/reactTable/checktable";

const Report = () => {
  const title = "Reports";
  const [data, setData] = useState([]);
  const [isLoding, setIsLoding] = useState(false);
  const [selectedValues, setSelectedValues] = useState([]);
  const [summary, setSummary] = useState([]);
  // const [selectedColumns, setSelectedColumns] = useState([]);
  // const [columns, setColumns] = useState([]);

  const user = JSON.parse(localStorage.getItem("user"));

  const tableColumns = [
    { Header: tr("Email Sent"), accessor: "emailsent" },
    { Header: tr("Outbound Calls"), accessor: "outboundcall" },
    { Header: tr("Text messages"), accessor: "textsent" },
    { Header: tr("Tasks"), accessor: "tasks" },
    { Header: tr("Completed Tasks"), accessor: "completedTasks" },
  ];

  // const fetchCustomDataFields = async () => {
  //     const tempTableColumns = [
  //         { Header: '#', accessor: '_id' },
  //         { Header: 'Name', accessor: 'firstName' },
  //         { Header: 'Email Sent', accessor: 'emailsent' },
  //         { Header: "Outbound Calls", accessor: "outboundcall" },
  //     ];
  //     // setSelectedColumns(JSON.parse(JSON.stringify(tempTableColumns)));
  // }

  if (user?.role === "admin") {
    tableColumns?.unshift(
      {
        Header: tr("#"),
        accessor: "_id",
        isSortable: false,
        width: 10,
      },
      { Header: tr("Name"), accessor: "firstName" },
    );
  }

  const fetchData = async () => {
    setIsLoding(true);
    let result = await getApi(
      user?.role === "admin"
        ? "api/reporting"
        : `api/reporting?_id=${user?._id}`,
    );
    if (result && result?.status === 200) {
      setData(result?.data);
    }
    const summaryResult = await getApi("api/reporting/line-chart");
    if (summaryResult?.status === 200) setSummary(summaryResult.data || []);
    setIsLoding(false);
  };

  // const [columns, setColumns] = useState([...tableColumns]);
  // const [selectedColumns, setSelectedColumns] = useState([...tableColumns]);
  // const dataColumn = tableColumns?.filter(item => selectedColumns?.find(colum => colum?.Header === item.Header))
  useEffect(() => {
    fetchData();
    // fetchCustomDataFields()
  }, []);

  return (
    <div>
      <SimpleGrid columns={{ base: 2, md: 4, xl: 7 }} spacing={3} mb={4}>
        {summary.map((item) => (
          <Card key={item.name} py={4}>
            <Stat>
              <StatLabel color="gray.500" fontSize="xs">{tr(item.name)}</StatLabel>
              <StatNumber fontSize="2xl">{item.length}</StatNumber>
            </Stat>
          </Card>
        ))}
      </SimpleGrid>
      <ReportChart />
      <Card mt={4}>
        <CommonCheckTable
          title={title}
          isLoding={isLoding}
          columnData={tableColumns ?? []}
          // dataColumn={dataColumn ?? []}
          allData={data ?? []}
          tableData={data}
          AdvanceSearch={false}
          checkBox={false}
          tableCustomFields={[]}
          deleteMany={true}
          // selectedValues={selectedValues}
          // setSelectedValues={setSelectedValues}
          // selectedColumns={selectedColumns}
          // setSelectedColumns={setSelectedColumns}
        />
      </Card>
    </div>
  );
};

export default withLocalization(Report);
