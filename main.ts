import { diff, applyChange } from 'deep-diff';

export const cleanObj = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanObj)
  }

  const newObj: any = {};

  for (const key of Object.keys(obj)) {
    if (['creationTimestamp', 'resourceVersion', 'uid', 'generation', 'managedFields', 'selfLink', 'status'].includes(key)) {
      continue;
    }
    if (key === 'annotations') {
      const filteredAnnot = {...obj[key]};
      delete filteredAnnot["kubectl.kubernetes.io/last-applied-configuration"];
      if (Object.keys(filteredAnnot).length) {
        newObj[key] = cleanObj(filteredAnnot);
      }
      continue;
    }
    newObj[key] = cleanObj(obj[key]);
  }
  return newObj;
}

export const getDiff = (obj1: any, obj2: any) => {
  const differences = diff(cleanObj(obj1), cleanObj(obj2)) || [];
  return differences.filter((d: any) => {
    if (!d.path) return false;
    const path = d.path.join(".");
    return (
      path.startsWith("metadata.name") || 
      path.startsWith("metadata.namespace") || 
      path.startsWith("metadata.labels") || 
      path.startsWith("spec.replicas") || 
      path.startsWith("spec.template.spec.containers") || 
      path.startsWith("spec.template.spec.volumes")
    )
  });
};

export const formatDiff = (diffs: any[]) => {
  return diffs.map((d: any) => {
    const path = d.path.join(".");
    switch(d.kind) {
      case "E": 
      return {path, lhs: d.lhs, rhs: d.rhs};
      default: 
      return null;
    }
  })
}

export const applySingleDiff = (target: any, diffItem: any) => {
  applyChange(target, {}, diffItem);
};


'use client'

import React, { useEffect, useState } from 'react';
import FileUploader from './components/FileUploader';
import YAMLDiffViewer from './components/DiffViewer';
import { getDiff, applySingleDiff, formatDiff } from '@/utils/diffUtils';
import { dumpYAML, parseYAML } from '@/utils/yarnUtils';
import { ValueOf } from 'next/dist/shared/lib/constants';
import TokenForm from './components/TokenForm';
import { APIS } from '@/utils/openShift';
import { loader } from '@/utils/misc';
import Modal from '@/ui/modal';
import yamlObj from 'js-yaml';
import { difference } from 'next/dist/build/utils';

export interface IData {
  [key: string]: {
    url: string;
    token: string;
    env: string;
  }
}

const Diff = () => {

  const View = {
    Form: 'form',
    File: 'file'
  } as const;
  type TView = ValueOf<typeof View>;

  const [data, setData] = useState<IData>(
    {
      project1: {
        url: '',
        token: '',
        env: ''
      },
      project2: {
        url: '',
        token: '',
        env: ''
      }
    });
  const [projectList, setProjectList] = useState({ project1: [], project2: [] });
  const [podList, setPodList] = useState({ project1: [], project2: [] });
  const [yaml, setYaml] = useState<any[]>([]);
  const [project, setProject] = useState<Record<string, string>>({ project1: '', project2: '' });
  const [yamlContents, setYamlContents] = useState<string[]>(['', '']);
  const [diffs, setDiffs] = useState<{ yaml1: any; yaml2: any }>({ yaml1: '', yaml2: '' });
  // const [view, setView] = useState<TView>(View.Form);
  const [pagination, setPagination] = useState(0);
  const [podPairs, setPodPairs] = useState<any[]>([]);
  const [podGroups, setPodGroups] = useState<any>();
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const [steps, setSteps] = useState({
    authorize: {
      name: 'authorize',
      icon: '😕',
      completed: true,
      current: true
    },
    namespace: {
      name: 'namespace',
      icon: '😃',
      completed: false,
      current: false
    },
    domain: {
      name: 'domain',
      icon: '😍',
      completed: false,
      current: false
    },
    differences: {
      name: 'differences',
      icon: '😍',
      completed: false,
      current: false
    }
  });
  const groupNumber = 20;
  const handleDiff = (yaml1: string, yaml2: string) => {
    if (yaml1 && yaml2) {
      const obj1 = parseYAML(yaml1);
      const obj2 = parseYAML(yaml2);
      const differences = getDiff(obj1, obj2);
      return differences;
    }
  }

  const getDiffView = (yaml1: any, yaml2: any) => {
    const { lhs, rhs } = handleDiff(yaml1, yaml2);
    return <YAMLDiffViewer
      oldValue={lhs}
      newValue={rhs}
    />
  }

  const handleUpload = (content: string, index: number) => {
    const updated = [...yamlContents];
    updated[index] = content;
    setYamlContents(updated);

    const [yaml1, yaml2] = updated;
    // const diff = 
    getDiffView(yaml1, yaml2);
  };

  const handleData = (value: string, project: string, dataType: string) => {
    let newData = { ...data };
    if (dataType && value && newData[project]) {
      newData = {
        ...newData,
        [project]: {
          ...newData[project],
          [dataType]: value,
          env: value.match(/[a-zA-Z]+[0-9]+/g)?.[0] ? value.match(/[a-zA-Z]+[0-9]+/g)?.[0] : ''
        }
      }
    }
    setData(newData)
  }

  const handleMergeDiff = (diffItem: any) => {
    const targetObj = parseYAML(yamlContents[0]);
    applySingleDiff(targetObj, diffItem);
    const updatedYAML = dumpYAML(targetObj);
    const updated = [updatedYAML, yamlContents[1]];
    setYamlContents(updated);

    const obj1 = parseYAML(updated[0]);
    const obj2 = parseYAML(updated[1]);
    setDiffs(getDiff(obj1, obj2));
  };

  const groupedCall = async (apiList: string[]): Promise<any[]> => {
    loader();
    const newData = data.slice(0, 2);
    const newPodListResult = apiList.map((api: string) => Promise.all(newData.map(({ token, url }) => fetch('/api/openshift', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        token,
        api
      }),
    }).then((res) => res.json()) // parse each response as JSON);
    ))
    );
    // console.log(newPodListResult);
    const result = await Promise.all(newPodListResult);
    // console.log(result);
    loader();
    return result;
  }

  const combinedCall = async (api: string, url: string, token: string): Promise<any[]> => {
    loader();
    
    const result = await fetch('/api/openshift', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        token,
        api
      }),
    }).then((res) => res.json());
    loader();
    // console.log(result);
    return result;
  }

  /**
   * [{url1, token1}, {url2, token2}]
   * {project1 : podList[], project2: podList[]}
   */

  const fetchProject = async () => {
    // await fetch('/api/token', {
    //   method: 'GET',
    //    headers: {
    //     'Content-Type': 'application/json',
    //   }
    // })
    if ((data.project1.url && data.project1.token) || (data.project2.url && data.project2.token)) {
      let result1: any = await combinedCall(APIS.projects(), data?.project1.url, data?.project1.token);
      let result2: any = await combinedCall(APIS.projects(), data?.project2.url, data?.project2.token);
      // setProjectList(result.message.items);
      setProjectList({ project1: result1.message.items, project2: result2.message.items });
      setSteps((prevState) => {
        const newObj = { ...prevState };
        Object.values(newObj).forEach((item) => item.current = false);
        return {
          ...newObj,
          authorize: {
            ...newObj.authorize,
            current: false,
            completed: true
          },
          namespace: {
            ...newObj.namespace,
            current: true,
            completed: true
          }
        }
      });
    }
  };

  const createPodGroups = (podPairs: any[]) => {
    const foundGroups: any[] = [];
    let groups: any = {};
    podPairs.forEach(({ metadata1, metadata2 }: any, index: number) => {
      const subGroup1 = metadata1.labels["app.kubernetes.io/part-of"];
      const subGroup2 = metadata2.labels["app.kubernetes.io/part-of"];
      const subGroup = subGroup1 === subGroup2 ? subGroup1 : undefined
      if (subGroup && foundGroups.includes(subGroup1)) {
        const currentData = groups[subGroup];
        groups = {
          ...groups,
          [subGroup]: [...currentData, { metadata1, metadata2 }]
        };
      } else if (!foundGroups.includes(subGroup)) {
        foundGroups.push(subGroup);
        groups = {
          ...groups,
          [subGroup]: [{ metadata1, metadata2 }]
        }
      }
    });
    // podList.project1.forEach((item: any, index: number) => {
    //   const subGroup = item.metadata.labels["app.kubernetes.io/part-of"];
    //   if (subGroup && foundGroups.findIndex(subGroup) > -1) {
    //     const currentData = groups[subGroup];
    //     groups = {
    //       ...groups,
    //       [subGroup]: [...currentData, item]
    //     };
    //   } else if (foundGroups.findIndex(subGroup) === -1) {
    //     foundGroups.push(subGroup);
    //     groups = {
    //       ...groups,
    //       [subGroup]: [item]
    //     }
    //   }
    // });
    setPodGroups(groups);
  }

  const fetchPods = async () => {
    if ((data.project1.url && data.project1.token) || (data.project2.url && data.project2.token) && project.project1 && project.project2) {
      let result1: any = await combinedCall(APIS.pods(project.project1), data?.project1.url, data?.project1.token);
      let result2: any = await combinedCall(APIS.pods(project.project2), data?.project2.url, data?.project2.token);
      setPodList({ project1: result1.message.items, project2: result2.message.items });
      setSteps((prevState) => {
        const newObj = { ...prevState };
        Object.values(newObj).forEach((item) => item.current = false);
        return {
          ...newObj,
          namespace: {
            ...newObj.namespace,
            current: false,
            completed: true
          },
          domain: {
            ...newObj.domain,
            current: true,
            completed: true
          }
        }
      });
    }
  }


  const getPodPairs = () => {
    if (podList.project1.length && podList.project2.length) {
      // podList.project1 contains all pods of project1 similarly for project2.
      const podPairs: any[] = [];
      podList.project1.forEach(({ metadata }: { metadata: any }) => {
        podList.project2.find(({ metadata: metadata1 }: { metadata: any }) => {
          if (metadata.labels['app.kubernetes.io/instance']?.includes(metadata1.labels['app.kubernetes.io/instance'])) {
            podPairs.push({ metadata1: metadata, metadata2: metadata1 });
            return true;
          }
        })
      });
      /**
       * [{metadata1, metadata2}]
       * data.project1, data.project2
       * similar pods are paired from project1 and project2.
       */
      if (podPairs.length) {
        setPodPairs(podPairs);
        return podPairs;
      }
    }
  }

  const getGroupedPodYaml = async () => {
    if (selectedGroup && podGroups[selectedGroup]) {
      const yamlPairs: any[] = []
      loader();
      const itemToFetch = pagination + groupNumber;
      setPagination(itemToFetch);
      await Promise.all(podGroups[selectedGroup].slice(pagination, itemToFetch).map(async ({ metadata1, metadata2 }: any) => {
        const yaml1: any = await combinedCall(APIS.yaml(project.project1, metadata1.name), data.project1.url, data.project1.token);
        const yaml2: any = await combinedCall(APIS.yaml(project.project2, metadata2.name), data.project2.url, data.project2.token);
        if (yaml1 && yaml2) {
          yamlPairs.push({ yaml1: yaml1.message, yaml2: yaml2.message });
        }
      }));
      loader();
      setYaml((prevState) => [...prevState, ...yamlPairs]);
      setSteps((prevState) => {
        const newObj = { ...prevState };
        Object.values(newObj).forEach((item) => item.current = false);
        return {
          ...newObj,
          domain: {
            ...newObj.domain,
            current: false,
            completed: true
          },
          differences: {
            ...newObj.differences,
            current: true,
            completed: true
          }
        }
      });
    }
  }

  const Authorize = () => (
    <><TokenForm handleData={handleData} data={data} project='project1' index={1} />
      <TokenForm handleData={handleData} data={data} project='project2' index={2} />
      {!projectList?.project1?.length || !projectList?.project2?.length ?
        <button
          onClick={fetchProject}
          className="btn-circle absolute btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
        >
          Submit
        </button> : null}</>
  );

  const Namespace = () => (
    <>
      <fieldset className="fieldset w-1/3 m-1 p-10">
        <legend className="fieldset-legend">Namespace 1</legend>
        <select value={project.project1} className="select text-base-content" onChange={(e) => setProject((prevState) => ({ ...prevState, project1: e.target.value as TView }))}>
          <option disabled={true}>Select a namespace</option>
          {
            projectList?.project1?.map(({ metadata }: { metadata: any }) => <option key={metadata.name} value={metadata.name}>{metadata.name}</option>)
          }
        </select>
      </fieldset>
      <fieldset className="fieldset  w-1/3 m-1 p-10">
        <legend className="fieldset-legend">Namespace 2</legend>
        <select value={project.project2} className="select text-base-content" onChange={(e) => setProject((prevState) => ({ ...prevState, project2: e.target.value as TView }))}>
          <option disabled={true}>Select a namespace</option>
          {
            projectList?.project2?.map(({ metadata }: { metadata: any }) => <option key={metadata.name} value={metadata.name}>{metadata.name}</option>)
          }
        </select>
      </fieldset>
      {project.project1 && project.project2 ?
        <button
          onClick={fetchPods}
          className="btn-circle absolute btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
        >
          Fetch Pods
        </button> : null}
    </>
  );

  const Domain = () => (
    <>
      {podGroups && Object.keys(podGroups).length ? <>
        <fieldset className="fieldset w-full m-1 p-10">
          <legend className="fieldset-legend">Select Domain</legend>
          <select value={selectedGroup} className="select text-base-content" onChange={(e) => {
              setSelectedGroup(e.target.value);
              setPagination(0);
            }}>
            <option disabled={true}>Select a domain</option>
            {
              Object.keys(podGroups)?.map((item: string) => <option key={item} value={item}>{item}</option>)
            }
          </select>
          {selectedGroup && podGroups[selectedGroup] ?
            <div className='w-full flex items-center justify-center'>
              <span className='text-base-content text-lg'>{`Total Pods present in the ${selectedGroup} of ${project.project1} is ${podGroups[selectedGroup].length}`}</span>
              <button
                onClick={getGroupedPodYaml}
                className="btn-circle absolute btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
              >
                {`Compare ${podGroups[selectedGroup].length} Pods`}
              </button>
            </div>
            : null}
        </fieldset></> : null}</>
  );

  const Differences = () => (<div className='flex w-full bg-base-200 justify-between items-center flex-col p-4'>
    {yaml.length ? yaml.map(({ yaml1, yaml2 }) => (
      <div className='flex items-center w-full m-2 overflow-x-auto rounded-box border border-base-content/5 bg-base-100'>
      <table className='table'>
        <thead>
          <tr>
            <th></th>
          <th>{data.project1.env}</th>
          <th>{data.project2.env}</th>
          </tr>
          <tr>
            <th></th>
            <th>{selectedGroup}</th>
            <th>{selectedGroup}</th>
          </tr>
        </thead>
        <tbody>
          {
          formatDiff(getDiff(yaml1, yaml2))?.map((f: any, i) => <tr key={i}><td>{f?.path}</td><td>{f?.lhs}</td><td>{f?.rhs}</td></tr>)
         }
        </tbody>
      </table>
        <div className='w-1/5'><button className='btn' onClick={() => setDiffs({ yaml1, yaml2 })}>view diff</button></div>
      </div>
    )) : null}
  </div>);





  useEffect(() => {
    if (podList.project1.length && podList.project2.length) {
      const podPairs = getPodPairs();
      if (podPairs) {
        createPodGroups(podPairs);
      }
    }
  }, [podList])

  // useEffect(() => {
  //   async function fetchPods() {
  //     if (data?.length && project.project1 && project.project2) {
  //       // here we will have the list of the pods.
  //       const result: any = await groupedCall([APIS.pods(project.project1), APIS.pods(project.project2)]);

  //       // here we have all the pod name under pod[index].metadata.name
  //       const newPodList = result.map(({message}: {message: any}) => message.items.slice(0, 10).map(({ metadata }: { metadata: {name: string} }) => metadata.name));
  //       // if (data.length) {
  //       //   // allRequest = [[url1 with pod a, url2 with pod a] , [url1 with pod b, url2 with pod b], ...]
  //       //   // Wait for all requests to complete and return the parsed results
  //       //   // const result = await Promise.all(allRequests);
  //       //   loader();
  //       // }
  //     }
  //   }
  //   fetchPods();
  // }, [project, data]);



  return (
    <div className='w-full bg-base-200 h-full'>
      <div className='w-full flex items-center justify-center mt-1 mb-5'>
        <ul className="steps w-full">
          {
            Object.values(steps).map(({ completed, icon, name, current }) => (
              <li className={`step ${completed ? 'step-neutral' : ''} text-base-content`} onClick={() => completed ? setSteps((prevState) => {
                const newObj = { ...prevState };
                Object.values(newObj).forEach((item) => item.current = false);
                return {
                  ...newObj,
                  [name]: {
                    name,
                    completed,
                    icon,
                    current: true
                  }
                }
              }) : null}>
                <span className="step-icon font-size-xl">{icon}</span>{name}
              </li>
            ))
          }
        </ul>
      </div>
      <div className='w-full flex justify center items-center'>
        <div className='w-full'>
          <div className={`w-full justify-center items-center relative ${steps.authorize.current ? 'flex' : 'hidden'}`}>
            <Authorize />
          </div>
          <div className={`w-full justify-center items-center relative ${steps.namespace.current ? 'flex' : 'hidden'}`}>
            <Namespace />
          </div>
          <div className={`w-full justify-center items-center relative ${steps.domain.current ? 'flex' : 'hidden'}`}>
            <Domain />
          </div>
          <div className={`w-full justify-center items-center relative ${steps.differences.current ? 'flex' : 'hidden'} text-base-content text-wrap`}>
            <Differences />
          </div>
        </div>
      </div>
      {diffs.yaml1 && diffs.yaml2 && <Modal
        isModalOpen={true}
        closeModal={() => setDiffs({ yaml1: '', yaml2: '' })}
        error={<></>}
      >
          <YAMLDiffViewer oldValue={yamlObj.dump(diffs.yaml1)} newValue={yamlObj.dump(diffs.yaml2)} splitView={true}/>
      </Modal>}
    </div>
  );
};

export default Diff;

import React, { JSX, useState } from 'react';
import DiffViewer, { DiffMethod } from 'react-diff-viewer';

interface Props {
    oldValue: string;
    newValue: string;
    splitView: boolean;
}

const YAMLDiffViewer: React.FC<Props> = ({ oldValue, newValue, splitView = false }) => {

    const [left, setLeft] = useState<string>(oldValue);
    const [right, setRight] = useState<string>(newValue);

    // const originalLines: string[] = left.split('\n');
    // const modifiedLines: string[] = right.split('\n');
    // const maxLines = Math.max(originalLines.length, modifiedLines.length);

    const handleMerge = (index: number, direction: 'left-to-right' | 'right-to-left') => {
        const newLeft = [...left];
        const newRight = [...right];

        if (direction === 'left-to-right') {
            newRight[index] = newLeft[index];
            setRight(newRight.join('\n'));
        } else {
            newLeft[index] = newRight[index];
            setLeft(newLeft.join('\n'));
        }
    };


    const customRenderContent = (str: string, i: number): JSX.Element => {


        const leftLine = left[i] ?? '';
        const rightLine = right[i] ?? '';
        const isDifferent = leftLine !== rightLine;

        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{str}</span>
                {isDifferent &&
                    (<>
                        <button onClick={() => handleMerge(i, 'left-to-right')} style={{ marginLeft: '8px' }}>
                            ➡️
                        </button>
                        <button onClick={() => handleMerge(i, 'right-to-left')} style={{ marginLeft: '4px' }}>
                            ⬅️
                        </button>
                    </>)
                }
            </div>
        )

    };

    const newStyles = {
        variables: {
            light: {
                codeFoldGutterBackground: "#6F767E",
                codeFoldBackground: "#E2E4E5"
            }
        },
        line: {
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap'
        }
    };

    if (oldValue && newValue) {
        return (
            <div className='text-base-content' style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
                    <DiffViewer
                        oldValue={oldValue}
                        newValue={newValue}
                        splitView={splitView}
                        compareMethod={DiffMethod.WORDS}
                        // renderContent={customRenderContent}
                        styles={newStyles}
                    />
                </div>
            </div>
        );
    }
    return null;

};

export default YAMLDiffViewer;


