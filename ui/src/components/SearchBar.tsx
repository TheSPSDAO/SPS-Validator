/**
 * Original code from https://github.com/TeamWertarbyte/material-ui-search-bar
 * Modified to work with v5 of mui.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Search, Clear } from "@mui/icons-material";
import { IconButton, Input, InputProps, Paper, Theme } from "@mui/material";
import { StyleRules, withStyles } from "@mui/styles";
import classNames from "classnames";

const styles = (theme: Theme): StyleRules => ({
  root: {
    height: theme.spacing(6),
    display: "flex",
    justifyContent: "space-between",
  },
  iconButton: {
    color: theme.palette.action.active,
    "&:hover": {
      backgroundColor: "transparent",
    },
    transform: "scale(1, 1)",
    transition: theme.transitions.create(["transform", "color"], {
      duration: theme.transitions.duration.shorter,
      easing: theme.transitions.easing.easeInOut,
    }),
  },
  iconButtonHidden: {
    transform: "scale(0, 0)",
    "& > $icon": {
      opacity: 0,
    },
  },
  searchIconButton: {
    marginRight: theme.spacing(-6),
  },
  icon: {
    transition: theme.transitions.create(["opacity"], {
      duration: theme.transitions.duration.shorter,
      easing: theme.transitions.easing.easeInOut,
    }),
  },
  input: {
    width: "100%",
  },
  searchContainer: {
    margin: "auto 16px",
    width: `calc(100% - ${theme.spacing(6 + 4)})`,
  },
});

const defaultProps = {
  closeIcon: <Clear />,
  searchIcon: <Search />,
  disabled: false,
  placeholder: "Search",
  value: "",
  className: "",
};

type Props = {
  cancelOnEscape?: boolean;
  className?: string;
  closeIcon?: JSX.Element;
  value?: string;
  onRequestSearch?: () => void;
  onCancelSearch?: () => void;
  onChange?: (query: string) => void;
  disabled?: boolean;
  searchIcon?: JSX.Element;
  placeholder?: string;
  classes?: {
    root?: string;
    iconButton?: string;
    iconButtonHidden?: string;
    iconButtonDisabled?: string;
    searchIconButton?: string;
    icon?: string;
    input?: string;
    searchContainer?: string;
  };
} & Pick<InputProps, "onBlur" | "onKeyUp" | "onFocus">;

const SearchBar = React.forwardRef<unknown, Props>(
  (
    {
      cancelOnEscape,
      className,
      closeIcon,
      disabled,
      onCancelSearch,
      onRequestSearch,
      searchIcon,
      classes,
      ...inputProps
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>();
    const [value, setValue] = useState<string>(inputProps.value!);

    useEffect(() => {
      setValue(inputProps.value!);
    }, [inputProps.value]);

    const handleFocus = useCallback(
      e => {
        if (inputProps.onFocus) {
          inputProps.onFocus(e);
        }
      },
      [inputProps.onFocus]
    );

    const handleBlur = useCallback(
      e => {
        setValue(v => v.trim());

        if (inputProps.onBlur) {
          inputProps.onBlur(e);
        }
      },
      [inputProps.onBlur]
    );

    const handleInput = useCallback(
      e => {
        setValue(e.target.value);

        if (inputProps.onChange) {
          inputProps.onChange(e.target.value);
        }
      },
      [inputProps.onChange]
    );

    const handleCancel = React.useCallback(() => {
      setValue("");

      onCancelSearch && onCancelSearch();
    }, [onCancelSearch]);

    const handleRequestSearch = useCallback(() => {
      onRequestSearch && onRequestSearch();
    }, [onRequestSearch, value]);

    const handleKeyUp = useCallback(
      e => {
        if (e.charCode === 13 || e.key === "Enter") {
          handleRequestSearch();
        } else if (
          cancelOnEscape &&
          (e.charCode === 27 || e.key === "Escape")
        ) {
          handleCancel();
        }

        if (inputProps.onKeyUp) {
          inputProps.onKeyUp(e);
        }
      },
      [handleRequestSearch, cancelOnEscape, handleCancel, inputProps.onKeyUp]
    );

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef?.current?.focus();
      },
      blur: () => {
        inputRef?.current?.blur();
      },
    }));

    return (
      <Paper className={classNames(classes!.root!, className)}>
        <div className={classes!.searchContainer!}>
          <Input
            {...inputProps}
            inputRef={inputRef}
            onBlur={handleBlur}
            value={value}
            onChange={handleInput}
            onKeyUp={handleKeyUp}
            onFocus={handleFocus}
            fullWidth
            disableUnderline
            disabled={disabled}
            className={classes!.input!}
          />
        </div>
        <IconButton
          onClick={handleRequestSearch}
          className={classNames(
            classes!.iconButton!,
            classes!.searchIconButton!,
            { [classes!.iconButtonHidden!]: value !== "" }
          )}
          disabled={disabled}
        >
          {React.cloneElement(searchIcon!, {
            classes: { root: classes!.icon! },
          })}
        </IconButton>
        <IconButton
          onClick={handleCancel}
          className={classNames(classes!.iconButton!, {
            [classes!.iconButtonHidden!]: value === "",
          })}
          disabled={disabled}
        >
          {React.cloneElement(closeIcon!, {
            classes: { root: classes!.icon! },
          })}
        </IconButton>
      </Paper>
    );
  }
);

SearchBar.defaultProps = defaultProps;

export default withStyles(styles)(SearchBar);
