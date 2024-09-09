import React, { useCallback, useState } from "react";
import { HiveService } from "../services/hive";
import { Box, Button, Card, Stack, TextField, Typography } from "@mui/material";
import styles from "./Time.module.css";
import { Label } from "@mui/icons-material";
import { FormattedMessage } from "react-intl";

const Time: React.FC = () => {
  const [formValues, setFormValues] = useState({ num: "1", time: "Unknown" });

  const handleClick = useCallback(
    (e: any) => {
      return HiveService.getHeadBlock().then(blockInfo => {
        const blockNumDiff = parseInt(formValues.num) - blockInfo.num;
        const targetTime = new Date(
          blockInfo.time.getTime() + blockNumDiff * 3000
        );

        setFormValues({
          ...formValues,
          time: targetTime.toISOString(),
        });
      });
    },
    [formValues, setFormValues]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  return (
    <div className={styles.box}>
      <FormattedMessage id={"time.title"} />
      <Box component="span" sx={{ display: "flex", flexDirection: "row" }}>
        <Card sx={{ minWidth: 250, padding: 2, margin: 2 }}>
          <Typography sx={{ fontSize: 14 }}>Number to Time</Typography>
          <Stack
            component="form"
            sx={{ "& MuiTextField-root": { m: 1, width: "25ch" } }}
            noValidate
            spacing={2}
            autoComplete="off"
          >
            <TextField
              name="num"
              variant="standard"
              label="Block Number"
              value={formValues.num}
              onChange={handleInputChange}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            />
            <TextField
              variant="standard"
              name="time"
              label="Block Time"
              value={formValues.time}
              inputProps={{ readOnly: true }}
            />
            <Button variant="outlined" onClick={handleClick}>
              Calculate
            </Button>
          </Stack>
        </Card>
        {/* TODO: Fix this direction, mui has a date picker, but it's in 5.0.0-beta I think */}
        <Card sx={{ minWidth: 250, padding: 2, margin: 2 }}>
          <Typography sx={{ fontSize: 14 }}>Time to Number</Typography>
          <Stack
            component="form"
            sx={{ "& MuiTextField-root": { m: 1, width: "25ch" } }}
            noValidate
            spacing={2}
            autoComplete="off"
          >
            <TextField
              disabled
              name="time"
              variant="standard"
              label="Block Time"
              value={formValues.time}
              onChange={handleInputChange}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            />
            <TextField
              disabled
              variant="standard"
              name="num"
              label="Block Number"
              value={formValues.num}
              inputProps={{ readOnly: true }}
            />
            <Button variant="outlined" onClick={handleClick} disabled>
              Calculate
            </Button>
          </Stack>
        </Card>
      </Box>
    </div>
  );
};

export default Time;
